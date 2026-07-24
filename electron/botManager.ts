import { EventEmitter } from "node:events";

import { createBot, type Bot, type BotOptions, type SkinParts } from "mineflayer";

import type {
  AppLogEntry,
  BotProfile,
  ChatMessage,
  ConnectBotRequest,
  SendBotMessageRequest,
  ServerTarget
} from "../src/shared/ipc";
import { resolveServerTarget } from "./serverStatus";

interface ManagedBot {
  profile: BotProfile;
  bot: Bot | null;
}

interface BotManagerEvents {
  update: [BotProfile];
  message: [ChatMessage];
  log: [AppLogEntry];
}

type EventName = keyof BotManagerEvents;

export class BotManager {
  private readonly bots = new Map<string, ManagedBot>();
  private readonly emitter = new EventEmitter();

  on<Event extends EventName>(
    event: Event,
    listener: (...payload: BotManagerEvents[Event]) => void
  ): () => void {
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }

  list(): BotProfile[] {
    return [...this.bots.values()].map((entry) => entry.profile);
  }

  add(usernames: string[]): BotProfile[] {
    const now = new Date().toISOString();
    const existing = new Set(this.list().map((bot) => bot.username.toLowerCase()));

    for (const username of usernames) {
      const normalized = normalizeUsername(username);
      if (!normalized || existing.has(normalized.toLowerCase())) {
        continue;
      }

      const profile: BotProfile = {
        id: crypto.randomUUID(),
        username: normalized,
        status: "idle",
        createdAt: now,
        connectedAt: null,
        disconnectedAt: null,
        lastError: null
      };

      existing.add(normalized.toLowerCase());
      this.bots.set(profile.id, { profile, bot: null });
      this.emitUpdate(profile);
    }

    return this.list();
  }

  remove(id: string): BotProfile[] {
    const entry = this.requireEntry(id);
    this.destroyBot(entry, "Kullanıcı tarafından kaldırıldı");
    this.bots.delete(id);
    this.emitLog("info", `${entry.profile.username} kaldırıldı`);
    return this.list();
  }

  clear(): BotProfile[] {
    for (const entry of this.bots.values()) {
      this.destroyBot(entry, "Liste temizlendi");
    }
    this.bots.clear();
    this.emitLog("info", "Bot listesi temizlendi");
    return [];
  }

  async connect(request: ConnectBotRequest): Promise<BotProfile> {
    const entry = this.requireEntry(request.id);
    if (entry.bot && entry.profile.status === "online") {
      return entry.profile;
    }

    this.destroyBot(entry, "Yeniden bağlanıyor");
    entry.profile = {
      ...entry.profile,
      status: "connecting",
      lastError: null,
      disconnectedAt: null
    };
    this.emitUpdate(entry.profile);

    const target = await resolveServerTarget(request);
    const options: BotOptions & { skinParts: SkinParts } = {
      host: target.host,
      port: target.port,
      username: entry.profile.username,
      version: target.version,
      auth: "offline",
      hideErrors: true,
      logErrors: false,
      physicsEnabled: false,
      viewDistance: "tiny",
      chat: "enabled",
      colorsEnabled: true,
      skinParts: createSkinParts(entry.profile.username)
    };
    const bot = createBot(options);

    entry.bot = bot;
    this.attachLifecycle(entry, bot, target);
    return entry.profile;
  }

  disconnect(id: string): BotProfile {
    const entry = this.requireEntry(id);
    this.destroyBot(entry, "Bağlantı kapatıldı");
    entry.profile = {
      ...entry.profile,
      status: "offline",
      disconnectedAt: new Date().toISOString()
    };
    this.emitUpdate(entry.profile);
    return entry.profile;
  }

  send(request: SendBotMessageRequest): ChatMessage {
    const entry = this.requireEntry(request.id);
    const bot = entry.bot;
    const message = request.message.trim();
    if (!bot || entry.profile.status !== "online") {
      throw new Error("Bot bağlı değil");
    }
    if (!message) {
      throw new Error("Mesaj boş olamaz");
    }

    bot.chat(message);
    const chatMessage = this.createMessage(entry.profile, "outgoing", message);
    this.emitMessage(chatMessage);
    return chatMessage;
  }

  broadcast(message: string): ChatMessage[] {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      throw new Error("Mesaj boş olamaz");
    }

    const sent: ChatMessage[] = [];
    for (const entry of this.bots.values()) {
      if (entry.bot && entry.profile.status === "online") {
        entry.bot.chat(cleanMessage);
        const chatMessage = this.createMessage(entry.profile, "outgoing", cleanMessage);
        sent.push(chatMessage);
        this.emitMessage(chatMessage);
      }
    }

    if (sent.length === 0) {
      throw new Error("Bağlı bot yok");
    }

    return sent;
  }

  destroyAll(): void {
    for (const entry of this.bots.values()) {
      this.destroyBot(entry, "Uygulama kapanıyor");
    }
  }

  private attachLifecycle(entry: ManagedBot, bot: Bot, target: ServerTarget): void {
    bot.once("login", () => {
      entry.profile = {
        ...entry.profile,
        status: "online",
        connectedAt: new Date().toISOString(),
        disconnectedAt: null,
        lastError: null
      };
      this.emitUpdate(entry.profile);
      this.emitLog(
        "info",
        `${entry.profile.username} ${target.host}:${target.port} sunucusuna bağlandı`
      );
    });

    bot.on("messagestr", (message) => {
      const clean = message.trim();
      if (clean.length > 0) {
        this.emitMessage(this.createMessage(entry.profile, "incoming", clean));
      }
    });

    bot.once("kicked", (reason) => {
      const cleanReason = normalizeKickReason(reason);
      entry.profile = {
        ...entry.profile,
        status: "error",
        lastError: cleanReason,
        disconnectedAt: new Date().toISOString()
      };
      this.emitUpdate(entry.profile);
      this.emitLog("warning", `${entry.profile.username} sunucudan atıldı: ${cleanReason}`);
    });

    bot.once("error", (error) => {
      entry.profile = {
        ...entry.profile,
        status: "error",
        lastError: error.message,
        disconnectedAt: new Date().toISOString()
      };
      this.emitUpdate(entry.profile);
      this.emitLog("error", `${entry.profile.username}: ${error.message}`);
    });

    bot.once("end", (reason) => {
      entry.bot = null;
      if (entry.profile.status !== "error") {
        entry.profile = {
          ...entry.profile,
          status: "offline",
          disconnectedAt: new Date().toISOString(),
          lastError: typeof reason === "string" && reason.length > 0 ? reason : null
        };
        this.emitUpdate(entry.profile);
      }
    });
  }

  private destroyBot(entry: ManagedBot, reason: string): void {
    if (!entry.bot) {
      return;
    }
    const bot = entry.bot;
    entry.bot = null;
    bot.removeAllListeners();
    bot.quit(reason);
  }

  private requireEntry(id: string): ManagedBot {
    const entry = this.bots.get(id);
    if (!entry) {
      throw new Error("Bot bulunamadı");
    }
    return entry;
  }

  private createMessage(
    profile: BotProfile,
    direction: ChatMessage["direction"],
    message: string
  ): ChatMessage {
    return {
      id: crypto.randomUUID(),
      botId: profile.id,
      username: profile.username,
      direction,
      message,
      timestamp: new Date().toISOString()
    };
  }

  private emitUpdate(profile: BotProfile): void {
    this.emitter.emit("update", profile);
  }

  private emitMessage(message: ChatMessage): void {
    this.emitter.emit("message", message);
  }

  private emitLog(level: AppLogEntry["level"], message: string): void {
    this.emitter.emit("log", {
      id: crypto.randomUUID(),
      level,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

function normalizeUsername(value: string): string | null {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
  return normalized.length >= 3 ? normalized : null;
}

function normalizeKickReason(reason: string): string {
  try {
    const parsed = JSON.parse(reason) as unknown;
    return textFromComponent(parsed) || reason;
  } catch {
    return reason;
  }
}

function textFromComponent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(textFromComponent).join("");
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    const extra = textFromComponent(record.extra);
    return `${text}${extra}`;
  }
  return "";
}

function createSkinParts(seed: string): SkinParts {
  const hash = stableHash(seed);
  return {
    showCape: (hash & 1) === 1,
    showJacket: (hash & 2) === 2,
    showLeftSleeve: (hash & 4) === 4,
    showRightSleeve: (hash & 8) === 8,
    showLeftPants: (hash & 16) === 16,
    showRightPants: (hash & 32) === 32,
    showHat: (hash & 64) === 64
  };
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
