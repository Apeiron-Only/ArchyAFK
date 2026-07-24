"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const botManager_1 = require("./botManager");
const serverStatus_1 = require("./serverStatus");
const botManager = new botManager_1.BotManager();
let mainWindow = null;
const applicationName = "ArchyAfk";
const applicationId = "com.archyafk.desktop";
function createMainWindow() {
    const iconPath = node_path_1.default.join(__dirname, "../../assets/logo.png");
    const showMainWindow = () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
    };
    mainWindow = new electron_1.BrowserWindow({
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
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            devTools: !electron_1.app.isPackaged
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
            .then((childCount) => {
            if (childCount <= 0) {
                console.error("[renderer] React root boş kaldı.");
            }
        })
            .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
        });
    });
    setTimeout(showMainWindow, 2_500);
    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    if (!electron_1.app.isPackaged && rendererUrl) {
        void mainWindow.loadURL(rendererUrl).catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            showMainWindow();
        });
        return;
    }
    void mainWindow
        .loadFile(node_path_1.default.join(__dirname, "../../build/renderer/index.html"))
        .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        showMainWindow();
    });
}
function registerIpc() {
    handle("window:minimize", () => {
        electron_1.BrowserWindow.getFocusedWindow()?.minimize();
        return true;
    });
    handle("window:close", () => {
        electron_1.BrowserWindow.getFocusedWindow()?.close();
        return true;
    });
    handle("app:versions", () => (0, serverStatus_1.getSupportedMinecraftVersions)());
    handle("server:ping", async (payload) => (0, serverStatus_1.pingServer)(payload));
    handle("bots:list", () => botManager.list());
    handle("bots:add", (payload) => botManager.add(payload.usernames));
    handle("bots:remove", (payload) => botManager.remove(payload.id));
    handle("bots:clear", () => botManager.clear());
    handle("bots:connect", (payload) => botManager.connect(payload));
    handle("bots:disconnect", (payload) => botManager.disconnect(payload.id));
    handle("bots:send", (payload) => botManager.send(payload));
    handle("bots:broadcast", (payload) => botManager.broadcast(payload.message));
}
function bridgeBotEvents() {
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
function handle(channel, listener) {
    electron_1.ipcMain.handle(channel, (_event, payload) => listener(payload));
}
electron_1.app.setName(applicationName);
electron_1.app.setAppUserModelId(applicationId);
electron_1.app.setPath("userData", node_path_1.default.join(electron_1.app.getPath("appData"), applicationName));
const lock = electron_1.app.requestSingleInstanceLock();
if (!lock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    void electron_1.app.whenReady().then(() => {
        registerIpc();
        bridgeBotEvents();
        createMainWindow();
    });
}
electron_1.app.on("before-quit", () => {
    botManager.destroyAll();
});
electron_1.app.on("window-all-closed", () => {
    botManager.destroyAll();
    electron_1.app.quit();
});
