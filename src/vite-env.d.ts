/// <reference types="vite/client" />

import type { JSX as ReactJsx } from "react";
import type { MinecraftAfkApi } from "./shared/ipc";

declare global {
  namespace JSX {
    type Element = ReactJsx.Element;
  }

  interface Window {
    minecraftAfk: MinecraftAfkApi;
  }
}

export {};
