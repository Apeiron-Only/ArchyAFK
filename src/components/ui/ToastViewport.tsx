import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info, X, XCircle } from "lucide-react";

import { useToastStore, type ToastTone } from "../../stores/toastStore";
import { IconButton } from "./IconButton";

const icons: Record<ToastTone, typeof Info> = {
  success: Check,
  info: Info,
  warning: AlertTriangle,
  error: XCircle
};

export function ToastViewport(): JSX.Element {
  const messages = useToastStore((state) => state.messages);
  const remove = useToastStore((state) => state.remove);

  return (
    <div className="pointer-events-none fixed right-5 top-16 z-[60] grid w-96 gap-3">
      <AnimatePresence>
        {messages.map((message) => {
          const Icon = icons[message.tone];
          return (
            <motion.div
              key={message.id}
              className="pointer-events-auto flex gap-3 rounded-lg border border-surface-border bg-surface-card p-3 shadow-shell"
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-md border border-surface-border bg-surface-base">
                <Icon className="size-4 text-ink-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-primary">{message.title}</p>
                {message.detail ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">
                    {message.detail}
                  </p>
                ) : null}
              </div>
              <IconButton icon={X} label="Bildirimi kapat" onClick={() => remove(message.id)} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
