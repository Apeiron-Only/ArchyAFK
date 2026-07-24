import type { IpcEventChannel, IpcEventMap, IpcInvokeChannel, IpcInvokeMap } from "../shared/ipc";

export function invokeElectron<Channel extends IpcInvokeChannel>(
  channel: Channel,
  payload: IpcInvokeMap[Channel]["request"]
): Promise<IpcInvokeMap[Channel]["response"]> {
  return window.minecraftAfk.invoke(channel, payload);
}

export function onElectronEvent<Channel extends IpcEventChannel>(
  channel: Channel,
  listener: (payload: IpcEventMap[Channel]) => void
): () => void {
  return window.minecraftAfk.on(channel, listener);
}
