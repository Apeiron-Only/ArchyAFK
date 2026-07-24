import { create } from "zustand";

export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastState {
  messages: ToastMessage[];
  push: (message: Omit<ToastMessage, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  messages: [],
  push: (message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [{ id, ...message }, ...state.messages].slice(0, 5)
    }));
    window.setTimeout(() => {
      useToastStore.getState().remove(id);
    }, 4200);
  },
  remove: (id) =>
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== id)
    })),
  clear: () => set({ messages: [] })
}));
