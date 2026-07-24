import { create } from "zustand";

import type { AppLogEntry, BotProfile, ChatMessage, ServerPingResult } from "../shared/ipc";

interface BotStoreState {
  bots: BotProfile[];
  messages: ChatMessage[];
  logs: AppLogEntry[];
  server: ServerPingResult | null;
  activeBotId: string | null;
  setBots: (bots: BotProfile[]) => void;
  upsertBot: (bot: BotProfile) => void;
  setServer: (server: ServerPingResult | null) => void;
  setActiveBotId: (id: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  addLog: (log: AppLogEntry) => void;
  clearRuntime: () => void;
}

export const useBotStore = create<BotStoreState>((set) => ({
  bots: [],
  messages: [],
  logs: [],
  server: null,
  activeBotId: null,
  setBots: (bots) => {
    set({ bots });
  },
  upsertBot: (bot) => {
    set((state) => ({
      bots: state.bots.some((item) => item.id === bot.id)
        ? state.bots.map((item) => (item.id === bot.id ? bot : item))
        : [...state.bots, bot]
    }));
  },
  setServer: (server) => {
    set({ server });
  },
  setActiveBotId: (activeBotId) => {
    set({ activeBotId });
  },
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message].slice(-2_000)
    }));
  },
  addLog: (log) => {
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 300)
    }));
  },
  clearRuntime: () => {
    set({ bots: [], messages: [], logs: [], server: null, activeBotId: null });
  }
}));
