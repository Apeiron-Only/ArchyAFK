import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

import { BotManager } from "./botManager";
import { getSupportedMinecraftVersions, pingServer } from "./serverStatus";
import type {
  AddBotsRequest,
  BroadcastMessageRequest,
  ConnectBotRequest,
  IpcInvokeChannel,
  IpcInvokeMap,
  RemoveBotRequest,
  SendBotMessageRequest,
  ServerTarget
} from "../src/shared/ipc";

const botManager = new BotManager();
let mainWindow: BrowserWindow | null = null;
const applicationName = "ArchyAfk";
const applicationId = "com.archyafk.desktop";

function createMainWindow(): void {
  const iconPath = path.join(__dirname, "../../assets/logo.png");

  const showMainWindow = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  };

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    maxWidth: 1280,
    maxHeight: 720,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: true,
    title: applicationName,
    icon: iconPath,
    backgroundColor: "#121212",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.once("ready-to-show", () => {
    showMainWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`[renderer] yüklenemedi (${code}) ${description}: ${url}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[renderer] süreç kapandı: ${details.reason}`);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level < 2) {
      return;
    }
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    showMainWindow();
    void mainWindow?.webContents
      .executeJavaScript("document.getElementById('root')?.children.length ?? -1")
      .then((childCount: number) => {
        if (childCount <= 0) {
          console.error("[renderer] React root boş kaldı.");
        }
      })
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
      });
  });

  setTimeout(showMainWindow, 2_500);

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && rendererUrl) {
    void mainWindow.loadURL(rendererUrl).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      showMainWindow();
    });
    return;
  }

  void mainWindow
    .loadFile(path.join(__dirname, "../../build/renderer/index.html"))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      showMainWindow();
    });
}

function registerIpc(): void {
  handle("window:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
    return true;
  });

  handle("window:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
    return true;
  });

  handle("app:versions", () => getSupportedMinecraftVersions());

  handle("server:ping", async (payload: ServerTarget) => pingServer(payload));

  handle("bots:list", () => botManager.list());

  handle("bots:add", (payload: AddBotsRequest) => botManager.add(payload.usernames));

  handle("bots:remove", (payload: RemoveBotRequest) => botManager.remove(payload.id));

  handle("bots:clear", () => botManager.clear());

  handle("bots:connect", (payload: ConnectBotRequest) => botManager.connect(payload));

  handle("bots:disconnect", (payload: RemoveBotRequest) => botManager.disconnect(payload.id));

  handle("bots:send", (payload: SendBotMessageRequest) => botManager.send(payload));

  handle("bots:broadcast", (payload: BroadcastMessageRequest) =>
    botManager.broadcast(payload.message)
  );
}

function bridgeBotEvents(): void {
  botManager.on("update", (profile) => {
    mainWindow?.webContents.send("bot:update", profile);
  });

  botManager.on("message", (message) => {
    mainWindow?.webContents.send("bot:message", message);
  });

  botManager.on("log", (log) => {
    mainWindow?.webContents.send("app:log", log);
  });
}

function handle<Channel extends IpcInvokeChannel>(
  channel: Channel,
  listener: (
    payload: IpcInvokeMap[Channel]["request"]
  ) => IpcInvokeMap[Channel]["response"] | Promise<IpcInvokeMap[Channel]["response"]>
): void {
  ipcMain.handle(channel, (_event, payload: unknown) =>
    listener(payload as IpcInvokeMap[Channel]["request"])
  );
}

app.setName(applicationName);
app.setAppUserModelId(applicationId);
app.setPath("userData", path.join(app.getPath("appData"), applicationName));

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    bridgeBotEvents();
    createMainWindow();
  });
}

app.on("before-quit", () => {
  botManager.destroyAll();
});

app.on("window-all-closed", () => {
  botManager.destroyAll();
  app.quit();
});
