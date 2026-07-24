export type BotStatus = "idle" | "connecting" | "online" | "offline" | "error";

export interface BotProfile {
  id: string;
  username: string;
  status: BotStatus;
  createdAt: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
}

export interface ServerTarget {
  host: string;
  port: number;
  version: string;
}

export interface ServerPingResult {
  online: boolean;
  host: string;
  port: number;
  motd: string | null;
  playersOnline: number | null;
  playersMax: number | null;
  versionName: string | null;
  protocol: number | null;
  favicon: string | null;
  latency: number | null;
  checkedAt: string;
  error: string | null;
}

export interface ChatMessage {
  id: string;
  botId: string;
  username: string;
  direction: "incoming" | "outgoing" | "system";
  message: string;
  timestamp: string;
}

export interface AppLogEntry {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  timestamp: string;
}

export interface AddBotsRequest {
  usernames: string[];
}

export interface RemoveBotRequest {
  id: string;
}

export interface ConnectBotRequest extends ServerTarget {
  id: string;
}

export interface SendBotMessageRequest {
  id: string;
  message: string;
}

export interface BroadcastMessageRequest {
  message: string;
}

export interface IpcInvokeMap {
  "window:minimize": { request: null; response: true };
  "window:close": { request: null; response: true };
  "app:versions": { request: null; response: string[] };
  "server:ping": { request: ServerTarget; response: ServerPingResult };
  "bots:list": { request: null; response: BotProfile[] };
  "bots:add": { request: AddBotsRequest; response: BotProfile[] };
  "bots:remove": { request: RemoveBotRequest; response: BotProfile[] };
  "bots:clear": { request: null; response: BotProfile[] };
  "bots:connect": { request: ConnectBotRequest; response: BotProfile };
  "bots:disconnect": { request: RemoveBotRequest; response: BotProfile };
  "bots:send": { request: SendBotMessageRequest; response: ChatMessage };
  "bots:broadcast": { request: BroadcastMessageRequest; response: ChatMessage[] };
}

export interface IpcEventMap {
  "bot:update": BotProfile;
  "bot:message": ChatMessage;
  "app:log": AppLogEntry;
}

export type IpcInvokeChannel = keyof IpcInvokeMap;
export type IpcEventChannel = keyof IpcEventMap;

export interface MinecraftAfkApi {
  invoke: <Channel extends IpcInvokeChannel>(
    channel: Channel,
    payload: IpcInvokeMap[Channel]["request"]
  ) => Promise<IpcInvokeMap[Channel]["response"]>;
  on: <Channel extends IpcEventChannel>(
    channel: Channel,
    listener: (payload: IpcEventMap[Channel]) => void
  ) => () => void;
}
