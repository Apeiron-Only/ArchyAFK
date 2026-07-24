import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string | undefined;
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  widthClassName = "max-w-2xl"
}: DialogProps): JSX.Element {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            aria-modal="true"
            className={`w-full ${widthClassName} rounded-lg border border-surface-border bg-surface-card shadow-shell`}
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex h-14 items-center justify-between border-b border-surface-border px-5">
              <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
              <IconButton icon={X} label="Kapat" onClick={onClose} />
            </header>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
