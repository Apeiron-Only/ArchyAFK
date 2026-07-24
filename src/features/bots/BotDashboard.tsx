import logo from "../../../assets/logo.png";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardList,
  Eraser,
  Gauge,
  Info,
  Layers3,
  Loader2,
  MessageSquare,
  Minus,
  Play,
  PlugZap,
  Power,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Square,
  Terminal,
  Trash2,
  UserPlus,
  Users,
  WandSparkles,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { ToastViewport } from "../../components/ui/ToastViewport";
import { invokeElectron, onElectronEvent } from "../../services/electronApi";
import { useBotStore } from "../../stores/botStore";
import { useToastStore } from "../../stores/toastStore";
import type {
  AppLogEntry,
  BotProfile,
  BotStatus,
  ChatMessage,
  ServerPingResult,
  ServerTarget
} from "../../shared/ipc";
import {
  generateBotUsernames,
  isValidMinecraftUsername,
  normalizeUsername
} from "../../utils/botNameGenerator";
import { cn } from "../../utils/cn";
import { formatDateTime, formatLatency, formatNumber } from "../../utils/format";

const defaultServer: ServerTarget = {
  host: "",
  port: 25565,
  version: "1.20.4"
};

type PageId = "overview" | "server" | "create" | "bots" | "chat" | "logs" | "info";

interface NavigationItem {
  id: PageId;
  label: string;
  description: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { id: "overview", label: "Genel Bakış", description: "Canlı özet", icon: Gauge },
  { id: "server", label: "Sunucu", description: "Ping ve hedef", icon: Server },
  { id: "create", label: "Bot Oluştur", description: "Tekil ve toplu", icon: UserPlus },
  { id: "bots", label: "Botlar", description: "Bağlantı kuyruğu", icon: Bot },
  { id: "chat", label: "Sohbet", description: "Bot komutları", icon: MessageSquare },
  { id: "logs", label: "Kayıtlar", description: "Olay akışı", icon: Terminal },
  { id: "info", label: "Bilgi", description: "Kullanım rehberi", icon: Info }
];

const fallbackNavigationItem: NavigationItem = navigationItems[0] ?? {
  id: "overview",
  label: "Genel Bakış",
  description: "Canlı özet",
  icon: Gauge
};

const connectDelayMs = 8_000;

export function BotDashboard(): JSX.Element {
  const bots = useBotStore((state) => state.bots);
  const setBots = useBotStore((state) => state.setBots);
  const upsertBot = useBotStore((state) => state.upsertBot);
  const messages = useBotStore((state) => state.messages);
  const addMessage = useBotStore((state) => state.addMessage);
  const logs = useBotStore((state) => state.logs);
  const addLog = useBotStore((state) => state.addLog);
  const server = useBotStore((state) => state.server);
  const setServer = useBotStore((state) => state.setServer);
  const activeBotId = useBotStore((state) => state.activeBotId);
  const setActiveBotId = useBotStore((state) => state.setActiveBotId);
  const pushToast = useToastStore((state) => state.push);

  const [page, setPage] = useState<PageId>("overview");
  const [versions, setVersions] = useState<string[]>([defaultServer.version]);
  const [target, setTarget] = useState<ServerTarget>(defaultServer);
  const [manualUsername, setManualUsername] = useState("");
  const [bulkCount, setBulkCount] = useState(25);
  const [query, setQuery] = useState("");
  const [pinging, setPinging] = useState(false);
  const [busyBotId, setBusyBotId] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [globalText, setGlobalText] = useState("");
  const [bulkConnecting, setBulkConnecting] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ done: 0, total: 0 });
  const [showSplash, setShowSplash] = useState(true);
  const cancelBulkConnectRef = useRef(false);
  const shouldCancelBulkConnect = useCallback(() => cancelBulkConnectRef.current, []);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 2_200);
    const boot = async () => {
      const [loadedVersions, loadedBots] = await Promise.all([
        invokeElectron("app:versions", null),
        invokeElectron("bots:list", null)
      ]);
      const nextVersions = loadedVersions.length > 0 ? loadedVersions : [defaultServer.version];
      setVersions(nextVersions);
      setTarget((current) => ({
        ...current,
        version: nextVersions.includes(current.version)
          ? current.version
          : (nextVersions[nextVersions.length - 1] ?? current.version)
      }));
      setBots(loadedBots);
    };

    void boot().catch((error: unknown) => {
      pushToast({ tone: "error", title: "Başlatma hatası", detail: errorMessage(error) });
    });
    return () => window.clearTimeout(splashTimer);
  }, [pushToast, setBots]);

  useEffect(() => {
    const removeUpdate = onElectronEvent("bot:update", upsertBot);
    const removeMessage = onElectronEvent("bot:message", addMessage);
    const removeLog = onElectronEvent("app:log", addLog);
    return () => {
      removeUpdate();
      removeMessage();
      removeLog();
    };
  }, [addLog, addMessage, upsertBot]);

  const stats = useMemo(() => {
    const online = bots.filter((bot) => bot.status === "online").length;
    const connecting = bots.filter((bot) => bot.status === "connecting").length;
    const error = bots.filter((bot) => bot.status === "error").length;
    const offline = bots.filter((bot) => bot.status === "offline" || bot.status === "idle").length;
    return { online, connecting, error, offline, total: bots.length };
  }, [bots]);

  const visibleBots = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return bots;
    }
    return bots.filter(
      (bot) =>
        bot.username.toLowerCase().includes(needle) ||
        bot.status.toLowerCase().includes(needle) ||
        (bot.lastError?.toLowerCase().includes(needle) ?? false)
    );
  }, [bots, query]);

  const activeBot = useMemo(
    () => bots.find((bot) => bot.id === activeBotId) ?? null,
    [activeBotId, bots]
  );

  const activeMessages = useMemo(
    () => (activeBot ? messages.filter((message) => message.botId === activeBot.id) : []),
    [activeBot, messages]
  );

  const ping = useCallback(async () => {
    if (!target.host.trim()) {
      pushToast({ tone: "warning", title: "Sunucu adresi gerekli" });
      setPage("server");
      return;
    }

    setPinging(true);
    try {
      const result = await invokeElectron("server:ping", target);
      setServer(result);
      pushToast({
        tone: result.online ? "success" : "warning",
        title: result.online ? "Sunucu online" : "Sunucu offline",
        detail: result.online
          ? `${formatNumber(result.playersOnline ?? null)} / ${formatNumber(result.playersMax ?? null)} oyuncu`
          : (result.error ?? "Yanıt alınamadı")
      });
    } catch (error) {
      pushToast({ tone: "error", title: "Sorgu başarısız", detail: errorMessage(error) });
    } finally {
      setPinging(false);
    }
  }, [pushToast, setServer, target]);

  const addManualBot = useCallback(async () => {
    const username = normalizeUsername(manualUsername);
    if (!isValidMinecraftUsername(username)) {
      pushToast({
        tone: "warning",
        title: "Geçersiz kullanıcı adı",
        detail: "3-16 karakter, harf, sayı ve alt çizgi kullanın."
      });
      return;
    }

    const next = await invokeElectron("bots:add", { usernames: [username] });
    setBots(next);
    setManualUsername("");
    pushToast({ tone: "success", title: "Bot eklendi", detail: username });
    setPage("bots");
  }, [manualUsername, pushToast, setBots]);

  const generateBots = useCallback(async () => {
    const safeCount = Math.max(1, Math.min(1000, bulkCount));
    const usernames = generateBotUsernames(
      safeCount,
      bots.map((bot) => bot.username)
    );
    const next = await invokeElectron("bots:add", { usernames });
    setBots(next);
    pushToast({
      tone: "success",
      title: "Bot profilleri oluşturuldu",
      detail: `${usernames.length} profil eklendi.`
    });
    setPage("bots");
  }, [bots, bulkCount, pushToast, setBots]);

  const clearBots = useCallback(async () => {
    const next = await invokeElectron("bots:clear", null);
    setBots(next);
    setActiveBotId(null);
    pushToast({ tone: "info", title: "Bot listesi temizlendi" });
  }, [pushToast, setActiveBotId, setBots]);

  const connectBot = useCallback(
    async (bot: BotProfile) => {
      if (!target.host.trim()) {
        pushToast({ tone: "warning", title: "Önce sunucu adresi girin" });
        setPage("server");
        return;
      }

      if (bot.status === "online") {
        setActiveBotId(bot.id);
        setPage("chat");
        return;
      }

      if (bot.status === "connecting") {
        return;
      }

      setBusyBotId(bot.id);
      try {
        const updated = await invokeElectron("bots:connect", { id: bot.id, ...target });
        upsertBot(updated);
      } catch (error) {
        pushToast({ tone: "error", title: "Bağlantı başarısız", detail: errorMessage(error) });
      } finally {
        setBusyBotId(null);
      }
    },
    [pushToast, setActiveBotId, target, upsertBot]
  );

  const disconnectBot = useCallback(
    async (id: string) => {
      const updated = await invokeElectron("bots:disconnect", { id });
      upsertBot(updated);
    },
    [upsertBot]
  );

  const removeBot = useCallback(
    async (id: string) => {
      const next = await invokeElectron("bots:remove", { id });
      setBots(next);
      if (activeBotId === id) {
        setActiveBotId(null);
      }
    },
    [activeBotId, setActiveBotId, setBots]
  );

  const connectAllQueued = useCallback(async () => {
    if (!target.host.trim()) {
      pushToast({ tone: "warning", title: "Önce sunucu adresi girin" });
      setPage("server");
      return;
    }

    const queue = bots.filter((bot) => bot.status !== "online" && bot.status !== "connecting");
    if (queue.length === 0) {
      pushToast({ tone: "info", title: "Bağlanacak bot yok" });
      return;
    }

    cancelBulkConnectRef.current = false;
    setBulkConnecting(true);
    setQueueProgress({ done: 0, total: queue.length });
    setPage("bots");

    for (const [index, bot] of queue.entries()) {
      if (shouldCancelBulkConnect()) {
        break;
      }

      setBusyBotId(bot.id);
      try {
        const updated = await invokeElectron("bots:connect", { id: bot.id, ...target });
        upsertBot(updated);
      } catch (error) {
        pushToast({
          tone: "error",
          title: `${bot.username} bağlanamadı`,
          detail: errorMessage(error)
        });
      } finally {
        setBusyBotId(null);
        setQueueProgress({ done: index + 1, total: queue.length });
      }

      if (index < queue.length - 1 && !shouldCancelBulkConnect()) {
        await delay(connectDelayMs);
      }
    }

    setBulkConnecting(false);
    cancelBulkConnectRef.current = false;
  }, [bots, pushToast, shouldCancelBulkConnect, target, upsertBot]);

  const stopBulkConnect = useCallback(() => {
    cancelBulkConnectRef.current = true;
    setBulkConnecting(false);
    pushToast({ tone: "info", title: "Toplu bağlantı kuyruğu durduruldu" });
  }, [pushToast]);

  const sendToActiveBot = useCallback(async () => {
    if (!activeBot || !chatText.trim()) {
      return;
    }
    try {
      await invokeElectron("bots:send", { id: activeBot.id, message: chatText });
      setChatText("");
    } catch (error) {
      pushToast({ tone: "error", title: "Mesaj gönderilemedi", detail: errorMessage(error) });
    }
  }, [activeBot, chatText, pushToast]);

  const broadcast = useCallback(async () => {
    if (!globalText.trim()) {
      return;
    }
    try {
      const sent = await invokeElectron("bots:broadcast", { message: globalText });
      pushToast({
        tone: "success",
        title: "Global komut gönderildi",
        detail: `${sent.length} bot`
      });
      setGlobalText("");
    } catch (error) {
      pushToast({ tone: "error", title: "Global gönderim başarısız", detail: errorMessage(error) });
    }
  }, [globalText, pushToast]);

  return (
    <div className="grid h-screen w-screen grid-rows-[40px_1fr_68px] overflow-hidden bg-surface-base text-ink-primary">
      <Titlebar />
      <main className="grid min-h-0 grid-cols-[220px_1fr]">
        <Sidebar activePage={page} stats={stats} onNavigate={setPage} />
        <section className="grid min-h-0 grid-rows-[72px_1fr] border-l border-surface-border">
          <Topbar
            page={page}
            query={query}
            onQueryChange={setQuery}
            onOpenSettings={() => setPage("server")}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              className="min-h-0 overflow-hidden p-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              {page === "overview" ? (
                <OverviewPage
                  bots={bots}
                  stats={stats}
                  server={server}
                  logs={logs}
                  onPing={() => void ping()}
                  onConnectAll={() => void connectAllQueued()}
                  onCreateBots={() => setPage("create")}
                  pinging={pinging}
                  bulkConnecting={bulkConnecting}
                />
              ) : null}
              {page === "server" ? (
                <ServerPage
                  target={target}
                  versions={versions}
                  server={server}
                  pinging={pinging}
                  onTargetChange={setTarget}
                  onPing={() => void ping()}
                />
              ) : null}
              {page === "create" ? (
                <CreateBotsPage
                  manualUsername={manualUsername}
                  bulkCount={bulkCount}
                  onManualUsernameChange={setManualUsername}
                  onBulkCountChange={setBulkCount}
                  onAddManual={() => void addManualBot()}
                  onGenerate={() => void generateBots()}
                  onClear={() => void clearBots()}
                />
              ) : null}
              {page === "bots" ? (
                <BotsPage
                  bots={visibleBots}
                  total={bots.length}
                  serverReady={target.host.trim().length > 0}
                  busyBotId={busyBotId}
                  bulkConnecting={bulkConnecting}
                  queueProgress={queueProgress}
                  onBotClick={(bot) => void connectBot(bot)}
                  onConnect={(bot) => void connectBot(bot)}
                  onDisconnect={(id) => void disconnectBot(id)}
                  onRemove={(id) => void removeBot(id)}
                  onConnectAll={() => void connectAllQueued()}
                  onStopConnectAll={stopBulkConnect}
                />
              ) : null}
              {page === "chat" ? (
                <ChatPage
                  bots={bots}
                  activeBot={activeBot}
                  messages={activeMessages}
                  value={chatText}
                  onBotSelect={(id) => setActiveBotId(id)}
                  onValueChange={setChatText}
                  onSend={() => void sendToActiveBot()}
                />
              ) : null}
              {page === "logs" ? <LogsPage logs={logs} /> : null}
              {page === "info" ? <InfoPage /> : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
      <GlobalCommandPanel
        value={globalText}
        onlineCount={stats.online}
        onChange={setGlobalText}
        onSend={() => void broadcast()}
      />
      <ToastViewport />
      <SplashScreen visible={showSplash} />
    </div>
  );
}

function Titlebar(): JSX.Element {
  return (
    <header className="drag-region flex items-center justify-between border-b border-surface-border bg-surface-card px-3">
      <div className="flex items-center gap-2">
        <img className="size-5" src={logo} alt="" draggable={false} />
        <span className="text-sm font-semibold">ArchyAfk</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <IconButton
          icon={Minus}
          label="Aşağı al"
          onClick={() => {
            void invokeElectron("window:minimize", null);
          }}
        />
        <IconButton
          icon={X}
          label="Kapat"
          onClick={() => {
            void invokeElectron("window:close", null);
          }}
        />
      </div>
    </header>
  );
}

function Sidebar({
  activePage,
  stats,
  onNavigate
}: {
  activePage: PageId;
  stats: { online: number; connecting: number; error: number; offline: number; total: number };
  onNavigate: (page: PageId) => void;
}): JSX.Element {
  return (
    <aside className="grid min-h-0 grid-rows-[84px_1fr_124px] bg-surface-card">
      <div className="flex items-center gap-3 border-b border-surface-border px-4">
        <img className="size-10 rounded-md border border-surface-border" src={logo} alt="" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">ArchyAfk</p>
          <p className="text-xs text-ink-secondary">AFK Operasyon Paneli</p>
        </div>
      </div>
      <nav className="space-y-1 overflow-y-auto p-3">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              "grid w-full grid-cols-[32px_1fr] items-center gap-2 rounded-md border px-2 py-2.5 text-left outline-none transition",
              activePage === item.id
                ? "border-white bg-white text-surface-base"
                : "border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
            )}
            type="button"
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="size-4 justify-self-center" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.label}</span>
              <span
                className={cn(
                  "block truncate text-[11px]",
                  activePage === item.id ? "text-surface-base/70" : "text-ink-secondary"
                )}
              >
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </nav>
      <div className="border-t border-surface-border p-3">
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Toplam" value={stats.total} />
          <MiniMetric label="Online" value={stats.online} />
        </div>
        <p className="mt-3 truncate text-[11px] text-ink-secondary">Yapımcı: Apeiron_Only</p>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  query,
  onQueryChange,
  onOpenSettings
}: {
  page: PageId;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenSettings: () => void;
}): JSX.Element {
  const active = navigationItems.find((item) => item.id === page) ?? fallbackNavigationItem;
  return (
    <header className="flex items-center justify-between border-b border-surface-border bg-surface-base px-5">
      <div>
        <h1 className="text-lg font-semibold">{active.label}</h1>
        <p className="text-xs text-ink-secondary">{active.description}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary" />
          <input
            className="h-10 w-full rounded-md border border-surface-border bg-surface-card pl-10 pr-3 text-sm outline-none transition placeholder:text-ink-secondary focus:border-white"
            placeholder="Bot veya durum ara"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <IconButton icon={Settings} label="Sunucu ayarları" onClick={onOpenSettings} />
      </div>
    </header>
  );
}

function OverviewPage({
  bots,
  stats,
  server,
  logs,
  pinging,
  bulkConnecting,
  onPing,
  onConnectAll,
  onCreateBots
}: {
  bots: BotProfile[];
  stats: { online: number; connecting: number; error: number; offline: number; total: number };
  server: ServerPingResult | null;
  logs: AppLogEntry[];
  pinging: boolean;
  bulkConnecting: boolean;
  onPing: () => void;
  onConnectAll: () => void;
  onCreateBots: () => void;
}): JSX.Element {
  return (
    <div className="grid h-full min-h-0 grid-rows-[120px_1fr] gap-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Toplam Bot" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Online" value={stats.online} />
        <StatCard icon={Loader2} label="Bağlanıyor" value={stats.connecting} />
        <StatCard icon={Activity} label="Hata" value={stats.error} />
      </div>
      <div className="grid min-h-0 grid-cols-[1.15fr_0.85fr] gap-4">
        <Card className="grid min-h-0 grid-rows-[64px_1fr] overflow-hidden">
          <PanelHeader
            icon={ClipboardList}
            title="Operasyon Özeti"
            right={
              <div className="flex gap-2">
                <Button icon={WandSparkles} size="sm" onClick={onCreateBots}>
                  Bot oluştur
                </Button>
                <Button icon={PlugZap} loading={bulkConnecting} size="sm" onClick={onConnectAll}>
                  Tümünü bağla
                </Button>
              </div>
            }
          />
          <div className="grid min-h-0 grid-cols-2 gap-4 p-4">
            <ServerStatusBlock server={server} pinging={pinging} onPing={onPing} />
            <RecentBotsBlock bots={bots.slice(0, 6)} />
          </div>
        </Card>
        <LogsCompact logs={logs} />
      </div>
    </div>
  );
}

function ServerPage({
  target,
  versions,
  server,
  pinging,
  onTargetChange,
  onPing
}: {
  target: ServerTarget;
  versions: string[];
  server: ServerPingResult | null;
  pinging: boolean;
  onTargetChange: (target: ServerTarget) => void;
  onPing: () => void;
}): JSX.Element {
  return (
    <div className="grid h-full min-h-0 grid-cols-[420px_1fr] gap-4">
      <Card className="p-5">
        <SectionTitle icon={Server} title="Sunucu Hedefi" />
        <div className="mt-5 grid gap-4">
          <LabeledInput
            label="Sunucu adresi"
            placeholder="play.example.com veya play.example.com:25565"
            value={target.host}
            onChange={(value) => onTargetChange({ ...target, host: value.trim() })}
            onEnter={onPing}
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              label="Port"
              type="number"
              value={String(target.port)}
              onChange={(value) => onTargetChange({ ...target, port: clampPort(value) })}
            />
            <label className="grid gap-2 text-xs font-medium text-ink-secondary">
              Sürüm
              <select
                className="h-10 rounded-md border border-surface-border bg-surface-base px-3 text-sm text-ink-primary outline-none transition focus:border-white"
                value={target.version}
                onChange={(event) => onTargetChange({ ...target, version: event.target.value })}
              >
                {versions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button icon={RefreshCw} loading={pinging} variant="primary" onClick={onPing}>
            Sunucuyu Sorgula
          </Button>
          <p className="rounded-md border border-surface-border bg-surface-base p-3 text-xs leading-5 text-ink-secondary">
            Domain SRV kaydı kullanıyorsa uygulama otomatik çözer. Adres alanına port yazarsanız
            port alanındaki değer yerine o port kullanılır.
          </p>
        </div>
      </Card>
      <ServerDetails server={server} />
    </div>
  );
}

function CreateBotsPage({
  manualUsername,
  bulkCount,
  onManualUsernameChange,
  onBulkCountChange,
  onAddManual,
  onGenerate,
  onClear
}: {
  manualUsername: string;
  bulkCount: number;
  onManualUsernameChange: (value: string) => void;
  onBulkCountChange: (value: number) => void;
  onAddManual: () => void;
  onGenerate: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-4">
      <Card className="p-5">
        <SectionTitle icon={UserPlus} title="Tekil Bot" />
        <div className="mt-5 grid gap-4">
          <LabeledInput
            label="Minecraft kullanıcı adı"
            placeholder="ShadowKnight99"
            value={manualUsername}
            onChange={onManualUsernameChange}
            onEnter={onAddManual}
          />
          <Button icon={UserPlus} variant="primary" onClick={onAddManual}>
            Tekil Bot Ekle
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle icon={WandSparkles} title="Toplu İsim Üretici" />
        <div className="mt-5 grid gap-4">
          <LabeledInput
            label="Üretilecek bot sayısı"
            type="number"
            value={String(bulkCount)}
            onChange={(value) => {
              const parsed = Number.parseInt(value, 10);
              onBulkCountChange(Math.max(1, Math.min(1000, Number.isFinite(parsed) ? parsed : 1)));
            }}
          />
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Button icon={WandSparkles} variant="primary" onClick={onGenerate}>
              Botları Üret
            </Button>
            <Button icon={Eraser} variant="ghost" onClick={onClear}>
              Listeyi Temizle
            </Button>
          </div>
          <p className="rounded-md border border-surface-border bg-surface-base p-3 text-xs leading-5 text-ink-secondary">
            Üretici anlamsız karakter dizileri yerine okunabilir Minecraft isimleri üretir ve mevcut
            profillerle çakışan isimleri atlar.
          </p>
        </div>
      </Card>
    </div>
  );
}

function BotsPage({
  bots,
  total,
  serverReady,
  busyBotId,
  bulkConnecting,
  queueProgress,
  onBotClick,
  onConnect,
  onDisconnect,
  onRemove,
  onConnectAll,
  onStopConnectAll
}: {
  bots: BotProfile[];
  total: number;
  serverReady: boolean;
  busyBotId: string | null;
  bulkConnecting: boolean;
  queueProgress: { done: number; total: number };
  onBotClick: (bot: BotProfile) => void;
  onConnect: (bot: BotProfile) => void;
  onDisconnect: (id: string) => void;
  onRemove: (id: string) => void;
  onConnectAll: () => void;
  onStopConnectAll: () => void;
}): JSX.Element {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[64px_52px_1fr] overflow-hidden">
      <PanelHeader
        icon={Bot}
        title="Bot Durumları"
        subtitle={`${formatNumber(total)} profil`}
        right={
          <div className="flex items-center gap-2">
            {bulkConnecting ? (
              <Badge tone="warning">
                {queueProgress.done}/{queueProgress.total}
              </Badge>
            ) : null}
            {bulkConnecting ? (
              <Button icon={Square} size="sm" variant="danger" onClick={onStopConnectAll}>
                Durdur
              </Button>
            ) : (
              <Button
                icon={PlugZap}
                size="sm"
                variant="primary"
                disabled={!serverReady || total === 0}
                onClick={onConnectAll}
              >
                Tümünü 8 sn aralıkla bağla
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-[1.1fr_130px_170px_1fr_184px] items-center border-b border-surface-border bg-surface-base px-4 text-xs font-semibold text-ink-secondary">
        <span>Bot</span>
        <span>Durum</span>
        <span>Son bağlantı</span>
        <span>Hata</span>
        <span className="text-right">İşlem</span>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {bots.length === 0 ? (
          <EmptyPanel
            icon={Users}
            title="Bot listesi boş"
            detail="Bot Oluştur sayfasından tekil veya toplu bot ekleyin."
          />
        ) : (
          bots.map((bot) => (
            <BotRow
              key={bot.id}
              bot={bot}
              busy={busyBotId === bot.id}
              onClick={() => onBotClick(bot)}
              onConnect={() => onConnect(bot)}
              onDisconnect={() => onDisconnect(bot.id)}
              onRemove={() => onRemove(bot.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function BotRow({
  bot,
  busy,
  onClick,
  onConnect,
  onDisconnect,
  onRemove
}: {
  bot: BotProfile;
  busy: boolean;
  onClick: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      className="grid h-14 w-full grid-cols-[1.1fr_130px_170px_1fr_184px] items-center border-b border-surface-border px-4 text-left text-sm transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-surface-border bg-surface-base">
          <Bot className="size-4 text-ink-secondary" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{bot.username}</span>
          <span className="block truncate text-xs text-ink-secondary">
            {statusLabel(bot.status)}
          </span>
        </span>
      </span>
      <span>
        <StatusBadge status={bot.status} busy={busy} />
      </span>
      <span className="truncate text-xs text-ink-secondary">
        {bot.connectedAt ? formatDateTime(bot.connectedAt) : "-"}
      </span>
      <span className="truncate text-xs text-ink-secondary">{bot.lastError ?? "-"}</span>
      <span className="flex justify-end gap-1">
        {bot.status === "online" ? (
          <MiniIconButton
            icon={Power}
            label="Bağlantıyı kapat"
            onClick={(event) => {
              event.stopPropagation();
              onDisconnect();
            }}
          />
        ) : (
          <MiniIconButton
            icon={Play}
            label="Sunucuya gir"
            onClick={(event) => {
              event.stopPropagation();
              onConnect();
            }}
          />
        )}
        <MiniIconButton
          icon={Trash2}
          label="Sil"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        />
      </span>
    </div>
  );
}

function ChatPage({
  bots,
  activeBot,
  messages,
  value,
  onBotSelect,
  onValueChange,
  onSend
}: {
  bots: BotProfile[];
  activeBot: BotProfile | null;
  messages: ChatMessage[];
  value: string;
  onBotSelect: (id: string) => void;
  onValueChange: (value: string) => void;
  onSend: () => void;
}): JSX.Element {
  const onlineBots = bots.filter((bot) => bot.status === "online");
  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] gap-4">
      <Card className="grid min-h-0 grid-rows-[56px_1fr] overflow-hidden">
        <PanelHeader icon={Users} title="Bağlı Botlar" subtitle={`${onlineBots.length} online`} />
        <div className="min-h-0 overflow-y-auto p-2">
          {onlineBots.length === 0 ? (
            <EmptyPanel
              icon={Bot}
              title="Online bot yok"
              detail="Botlar sayfasından bağlantı kurun."
            />
          ) : (
            onlineBots.map((bot) => (
              <button
                key={bot.id}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition",
                  activeBot?.id === bot.id
                    ? "bg-white text-surface-base"
                    : "text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
                )}
                type="button"
                onClick={() => onBotSelect(bot.id)}
              >
                <Circle className="size-3 fill-current" />
                <span className="truncate font-medium">{bot.username}</span>
              </button>
            ))
          )}
        </div>
      </Card>
      <Card className="grid min-h-0 grid-rows-[56px_1fr_64px] overflow-hidden">
        <PanelHeader
          icon={MessageSquare}
          title={activeBot ? activeBot.username : "Sohbet"}
          subtitle="Normal mesaj veya /komut gönderimi"
        />
        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          {!activeBot ? (
            <EmptyPanel
              icon={MessageSquare}
              title="Bot seçilmedi"
              detail="Online bir bot seçerek özel sohbet penceresini açın."
            />
          ) : messages.length === 0 ? (
            <EmptyPanel icon={MessageSquare} title="Sohbet boş" detail="Bu bot için mesaj yok." />
          ) : (
            messages.map((message) => <ChatBubble key={message.id} message={message} />)
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-surface-border p-3">
          <input
            className="h-10 rounded-md border border-surface-border bg-surface-base px-3 text-sm outline-none transition placeholder:text-ink-secondary focus:border-white"
            disabled={!activeBot}
            placeholder="Sohbet mesajı veya /komut"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => handleEnter(event, onSend)}
          />
          <Button
            icon={Send}
            variant="primary"
            disabled={!activeBot || !value.trim()}
            onClick={onSend}
          >
            Gönder
          </Button>
        </div>
      </Card>
    </div>
  );
}

function LogsPage({ logs }: { logs: AppLogEntry[] }): JSX.Element {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[56px_1fr] overflow-hidden">
      <PanelHeader icon={Terminal} title="Kayıt Akışı" subtitle={`${logs.length} kayıt`} />
      <div className="min-h-0 overflow-y-auto p-4">
        {logs.length === 0 ? (
          <EmptyPanel
            icon={Terminal}
            title="Kayıt yok"
            detail="Bot ve sunucu olayları burada görünür."
          />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[88px_150px_1fr] items-start gap-3 rounded-md border border-surface-border bg-surface-base p-3 text-sm"
              >
                <Badge
                  tone={
                    log.level === "error"
                      ? "error"
                      : log.level === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {log.level}
                </Badge>
                <span className="text-xs text-ink-secondary">{formatDateTime(log.timestamp)}</span>
                <span className="break-words text-ink-secondary">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function InfoPage(): JSX.Element {
  const steps = [
    "Sunucu sayfasında IP adresini girin. Domain SRV kullanıyorsa otomatik çözülür.",
    "Bot Oluştur sayfasında tek bot ekleyin veya toplu isim üreticiyle liste oluşturun.",
    "Botlar sayfasında tek botu Sunucuya gir butonuyla bağlayın veya tümünü 8 saniye aralıkla sıraya alın.",
    "Sohbet sayfasında online bot seçip mesaj ya da /komut gönderin.",
    "Alt Global Komut Paneli yalnızca online botlara aynı mesajı gönderir."
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_360px] gap-4">
      <Card className="p-5">
        <SectionTitle icon={Info} title="ArchyAfk Kullanım Rehberi" />
        <div className="mt-5 grid gap-3">
          {steps.map((step, index) => (
            <div
              key={step}
              className="grid grid-cols-[32px_1fr] items-start gap-3 rounded-md border border-surface-border bg-surface-base p-3"
            >
              <span className="grid size-8 place-items-center rounded-md border border-surface-border text-sm font-semibold">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-ink-secondary">{step}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle icon={Activity} title="Notlar" />
        <div className="mt-5 space-y-3 text-sm leading-6 text-ink-secondary">
          <p>Offline botlarda gerçek skin texture sunucu/skin eklentisine bağlıdır.</p>
          <p>Whitelist, botun sunucuya ulaştığını ama giriş izni olmadığını gösterir.</p>
          <p>
            RAM tüketimini düşük tutmak için botlarda düşük görüş mesafesi ve kapalı fizik
            kullanılır.
          </p>
          <p className="rounded-md border border-surface-border bg-surface-base p-3 text-xs">
            Yapımcı: Apeiron_Only
          </p>
        </div>
      </Card>
    </div>
  );
}

function GlobalCommandPanel({
  value,
  onlineCount,
  onChange,
  onSend
}: {
  value: string;
  onlineCount: number;
  onChange: (value: string) => void;
  onSend: () => void;
}): JSX.Element {
  return (
    <footer className="border-t border-surface-border bg-surface-card px-4 py-3">
      <div className="grid h-full grid-cols-[210px_1fr_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-surface-border bg-surface-base">
            <Layers3 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Global Komut Paneli</p>
            <p className="truncate text-xs text-ink-secondary">
              {formatNumber(onlineCount)} bağlı bot
            </p>
            <p className="truncate text-[10px] text-ink-secondary">Apeiron_Only</p>
          </div>
        </div>
        <input
          className="h-11 rounded-md border border-surface-border bg-surface-base px-3 text-sm outline-none transition placeholder:text-ink-secondary focus:border-white"
          placeholder="Tüm online botlara sohbet mesajı veya /komut gönder"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => handleEnter(event, onSend)}
        />
        <Button
          icon={Send}
          variant="primary"
          disabled={!value.trim() || onlineCount === 0}
          onClick={onSend}
        >
          Gönder
        </Button>
      </div>
    </footer>
  );
}

function SplashScreen({ visible }: { visible: boolean }): JSX.Element {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#07080a]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            className="grid justify-items-center gap-4"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.28 }}
          >
            <img
              className="size-24 rounded-2xl border border-surface-border bg-surface-card p-3 shadow-shell"
              src={logo}
              alt=""
              draggable={false}
            />
            <div className="text-center">
              <p className="text-xl font-semibold">ArchyAfk</p>
              <p className="mt-1 text-xs text-ink-secondary">Yapımcı: Apeiron_Only</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ServerStatusBlock({
  server,
  pinging,
  onPing
}: {
  server: ServerPingResult | null;
  pinging: boolean;
  onPing: () => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-base p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={Radio} title="Sunucu" compact />
        <Button icon={RefreshCw} size="sm" loading={pinging} onClick={onPing}>
          Sorgula
        </Button>
      </div>
      <div className="mt-4 flex gap-3">
        <ServerFavicon server={server} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={server?.online ? "online" : "offline"} />
            <p className="truncate text-sm font-semibold">
              {server?.online ? "Online" : "Sorgu bekleniyor"}
            </p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">
            {server?.motd ?? server?.error ?? "Sunucu adresi girip sorgulayın."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ServerDetails({ server }: { server: ServerPingResult | null }): JSX.Element {
  return (
    <Card className="p-5">
      <SectionTitle icon={Radio} title="Sunucu Bilgisi" />
      <div className="mt-5 flex items-start gap-4">
        <ServerFavicon server={server} large />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot status={server?.online ? "online" : "offline"} />
            <p className="truncate text-base font-semibold">
              {server?.online ? "Online" : "Offline / Bekleniyor"}
            </p>
          </div>
          <p className="mt-2 min-h-10 rounded-md border border-surface-border bg-surface-base p-3 text-sm leading-5 text-ink-secondary">
            {server?.motd ?? server?.error ?? "Henüz sorgu yapılmadı."}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Adres" value={server?.host ?? "-"} />
        <Metric label="Port" value={server ? String(server.port) : "-"} />
        <Metric
          label="Oyuncu"
          value={`${formatNumber(server?.playersOnline ?? null)} / ${formatNumber(server?.playersMax ?? null)}`}
        />
        <Metric label="Gecikme" value={formatLatency(server?.latency ?? null)} />
        <Metric label="Sürüm" value={server?.versionName ?? "-"} />
        <Metric label="Son kontrol" value={server ? formatDateTime(server.checkedAt) : "-"} />
      </div>
    </Card>
  );
}

function RecentBotsBlock({ bots }: { bots: BotProfile[] }): JSX.Element {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-base p-4">
      <SectionTitle icon={Bot} title="Son Botlar" compact />
      <div className="mt-4 space-y-2">
        {bots.length === 0 ? (
          <p className="text-sm text-ink-secondary">Henüz bot oluşturulmadı.</p>
        ) : (
          bots.map((bot) => (
            <div key={bot.id} className="flex h-9 items-center justify-between gap-3">
              <span className="truncate text-sm">{bot.username}</span>
              <StatusBadge status={bot.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LogsCompact({ logs }: { logs: AppLogEntry[] }): JSX.Element {
  return (
    <Card className="grid min-h-0 grid-rows-[56px_1fr] overflow-hidden">
      <PanelHeader icon={Terminal} title="Son Kayıtlar" />
      <div className="min-h-0 overflow-y-auto p-3">
        {logs.length === 0 ? (
          <EmptyPanel icon={Terminal} title="Kayıt yok" detail="Olaylar burada listelenir." />
        ) : (
          logs.slice(0, 8).map((log) => (
            <div
              key={log.id}
              className="mb-2 rounded-md border border-surface-border bg-surface-base p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge
                  tone={
                    log.level === "error"
                      ? "error"
                      : log.level === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {log.level}
                </Badge>
                <span className="text-[11px] text-ink-secondary">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-secondary">
                {log.message}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  right
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: JSX.Element;
}): JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-surface-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-ink-secondary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-xs text-ink-secondary">{subtitle}</p> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}): JSX.Element {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-medium text-ink-secondary">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p>
      </div>
      <div className="grid size-11 place-items-center rounded-md border border-surface-border bg-surface-base">
        <Icon className="size-5 text-ink-secondary" />
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-surface-border bg-surface-base p-3">
      <p className="text-[11px] font-medium text-ink-secondary">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-md border border-surface-border bg-surface-base p-2">
      <p className="text-[11px] text-ink-secondary">{label}</p>
      <p className="text-sm font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  compact = false
}: {
  icon: LucideIcon;
  title: string;
  compact?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("text-ink-secondary", compact ? "size-4" : "size-5")} />
      <h2 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{title}</h2>
    </div>
  );
}

function ServerFavicon({
  server,
  large = false
}: {
  server: ServerPingResult | null;
  large?: boolean;
}): JSX.Element {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg border border-surface-border bg-surface-base",
        large ? "size-20" : "size-14"
      )}
    >
      {server?.favicon ? (
        <img className="h-full w-full object-cover" src={server.favicon} alt="" />
      ) : (
        <Server className={cn("text-ink-secondary", large ? "size-8" : "size-6")} />
      )}
    </div>
  );
}

function StatusBadge({ status, busy = false }: { status: BotStatus; busy?: boolean }): JSX.Element {
  return (
    <Badge tone={status === "online" ? "strong" : status === "error" ? "error" : "neutral"}>
      <span className="flex items-center gap-1.5">
        {busy || status === "connecting" ? <Loader2 className="size-3 animate-spin" /> : null}
        {status}
      </span>
    </Badge>
  );
}

function StatusDot({ status }: { status: BotStatus }): JSX.Element {
  return (
    <Circle
      className={cn(
        "size-3 fill-current",
        status === "online" && "text-white",
        status === "connecting" && "animate-pulse text-ink-secondary",
        status === "error" && "text-white",
        (status === "idle" || status === "offline") && "text-ink-secondary"
      )}
    />
  );
}

function MiniIconButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-ink-secondary transition hover:bg-surface-card hover:text-white"
      type="button"
      onClick={onClick}
    >
      <Icon className="size-4" />
    </button>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  detail
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="grid h-full min-h-40 place-items-center rounded-lg border border-dashed border-surface-border p-6 text-center">
      <div className="grid justify-items-center gap-3">
        <Icon className="size-9 text-ink-secondary" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 max-w-72 text-xs leading-5 text-ink-secondary">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }): JSX.Element {
  const outgoing = message.direction === "outgoing";
  return (
    <div className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-lg border px-3 py-2",
          outgoing
            ? "border-white bg-white text-surface-base"
            : "border-surface-border bg-surface-base text-ink-primary"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{message.username}</span>
          <span
            className={cn("text-[11px]", outgoing ? "text-surface-base/70" : "text-ink-secondary")}
          >
            {formatDateTime(message.timestamp)}
          </span>
        </div>
        <p className="mt-1 break-words text-sm">{message.message}</p>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
  onEnter
}: {
  label: string;
  value: string;
  type?: "text" | "number";
  placeholder?: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}): JSX.Element {
  return (
    <label className="grid gap-2 text-xs font-medium text-ink-secondary">
      {label}
      <input
        className="h-10 rounded-md border border-surface-border bg-surface-base px-3 text-sm text-ink-primary outline-none transition placeholder:text-ink-secondary focus:border-white"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
      />
    </label>
  );
}

function handleEnter(event: KeyboardEvent<HTMLInputElement>, action?: () => void): void {
  if (event.key === "Enter") {
    action?.();
  }
}

function statusLabel(status: BotStatus): string {
  const labels: Record<BotStatus, string> = {
    idle: "Hazır, sunucuya girebilir",
    connecting: "Sunucuya bağlanıyor",
    online: "Online, sohbet açılır",
    offline: "Offline, tekrar bağlanabilir",
    error: "Hata aldı, tekrar denenebilir"
  };
  return labels[status];
}

function clampPort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 25565;
  }
  return Math.max(1, Math.min(65535, parsed));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
