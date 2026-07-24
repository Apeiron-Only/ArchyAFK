"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const invokeChannels = new Set([
    "window:minimize",
    "window:close",
    "app:versions",
    "server:ping",
    "bots:list",
    "bots:add",
    "bots:remove",
    "bots:clear",
    "bots:connect",
    "bots:disconnect",
    "bots:send",
    "bots:broadcast"
]);
const eventChannels = new Set(["bot:update", "bot:message", "app:log"]);
const api = {
    invoke: async (channel, payload) => {
        if (!invokeChannels.has(channel)) {
            throw new Error(`IPC kanalı engellendi: ${channel}`);
        }
        return electron_1.ipcRenderer.invoke(channel, payload);
    },
    on: (channel, listener) => {
        if (!eventChannels.has(channel)) {
            throw new Error(`IPC olayı engellendi: ${channel}`);
        }
        const subscription = (_event, payload) => {
            listener(payload);
        };
        electron_1.ipcRenderer.on(channel, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(channel, subscription);
        };
    }
};
electron_1.contextBridge.exposeInMainWorld("minecraftAfk", api);
