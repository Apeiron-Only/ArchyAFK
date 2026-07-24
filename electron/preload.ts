import { contextBridge, ipcRenderer } from "electron";

import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeMap,
  MinecraftAfkApi
} from "../src/shared/ipc";

const invokeChannels = new Set<IpcInvokeChannel>([
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

const eventChannels = new Set<IpcEventChannel>(["bot:update", "bot:message", "app:log"]);

const api: MinecraftAfkApi = {
  invoke: async (channel, payload) => {
    if (!invokeChannels.has(channel)) {
      throw new Error(`IPC kanalı engellendi: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload) as Promise<
      IpcInvokeMap[typeof channel]["response"]
    >;
  },
  on: (channel, listener) => {
    if (!eventChannels.has(channel)) {
      throw new Error(`IPC olayı engellendi: ${channel}`);
    }

    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: IpcEventMap[typeof channel]
    ) => {
      listener(payload);
    };

    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
};

contextBridge.exposeInMainWorld("minecraftAfk", api);
