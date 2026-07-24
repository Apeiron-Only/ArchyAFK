"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotManager = void 0;
const node_events_1 = require("node:events");
const mineflayer_1 = require("mineflayer");
const serverStatus_1 = require("./serverStatus");
class BotManager {
    bots = new Map();
    emitter = new node_events_1.EventEmitter();
    on(event, listener) {
        this.emitter.on(event, listener);
        return () => {
            this.emitter.off(event, listener);
        };
    }
    list() {
        return [...this.bots.values()].map((entry) => entry.profile);
    }
    add(usernames) {
        const now = new Date().toISOString();
        const existing = new Set(this.list().map((bot) => bot.username.toLowerCase()));
        for (const username of usernames) {
            const normalized = normalizeUsername(username);
            if (!normalized || existing.has(normalized.toLowerCase())) {
                continue;
            }
            const profile = {
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
    remove(id) {
        const entry = this.requireEntry(id);
        this.destroyBot(entry, "Kullanıcı tarafından kaldırıldı");
        this.bots.delete(id);
        this.emitLog("info", `${entry.profile.username} kaldırıldı`);
        return this.list();
    }
    clear() {
        for (const entry of this.bots.values()) {
            this.destroyBot(entry, "Liste temizlendi");
        }
        this.bots.clear();
        this.emitLog("info", "Bot listesi temizlendi");
        return [];
    }
    async connect(request) {
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
        const target = await (0, serverStatus_1.resolveServerTarget)(request);
        const options = {
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
        const bot = (0, mineflayer_1.createBot)(options);
        entry.bot = bot;
        this.attachLifecycle(entry, bot, target);
        return entry.profile;
    }
    disconnect(id) {
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
    send(request) {
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
    broadcast(message) {
        const cleanMessage = message.trim();
        if (!cleanMessage) {
            throw new Error("Mesaj boş olamaz");
        }
        const sent = [];
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
    destroyAll() {
        for (const entry of this.bots.values()) {
            this.destroyBot(entry, "Uygulama kapanıyor");
        }
    }
    attachLifecycle(entry, bot, target) {
        bot.once("login", () => {
            entry.profile = {
                ...entry.profile,
                status: "online",
                connectedAt: new Date().toISOString(),
                disconnectedAt: null,
                lastError: null
            };
            this.emitUpdate(entry.profile);
            this.emitLog("info", `${entry.profile.username} ${target.host}:${target.port} sunucusuna bağlandı`);
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
    destroyBot(entry, reason) {
        if (!entry.bot) {
            return;
        }
        const bot = entry.bot;
        entry.bot = null;
        bot.removeAllListeners();
        bot.quit(reason);
    }
    requireEntry(id) {
        const entry = this.bots.get(id);
        if (!entry) {
            throw new Error("Bot bulunamadı");
        }
        return entry;
    }
    createMessage(profile, direction, message) {
        return {
            id: crypto.randomUUID(),
            botId: profile.id,
            username: profile.username,
            direction,
            message,
            timestamp: new Date().toISOString()
        };
    }
    emitUpdate(profile) {
        this.emitter.emit("update", profile);
    }
    emitMessage(message) {
        this.emitter.emit("message", message);
    }
    emitLog(level, message) {
        this.emitter.emit("log", {
            id: crypto.randomUUID(),
            level,
            message,
            timestamp: new Date().toISOString()
        });
    }
}
exports.BotManager = BotManager;
function normalizeUsername(value) {
    const normalized = value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
    return normalized.length >= 3 ? normalized : null;
}
function normalizeKickReason(reason) {
    try {
        const parsed = JSON.parse(reason);
        return textFromComponent(parsed) || reason;
    }
    catch {
        return reason;
    }
}
function textFromComponent(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(textFromComponent).join("");
    }
    if (typeof value === "object" && value !== null) {
        const record = value;
        const text = typeof record.text === "string" ? record.text : "";
        const extra = textFromComponent(record.extra);
        return `${text}${extra}`;
    }
    return "";
}
function createSkinParts(seed) {
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
function stableHash(value) {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
}
