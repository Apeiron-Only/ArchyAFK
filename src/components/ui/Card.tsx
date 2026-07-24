import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "../../utils/cn";

interface CardProps {
  interactive?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function Card({ className, interactive = false, children }: CardProps): JSX.Element {
  return (
    <motion.div
      whileHover={interactive ? { y: -2 } : { y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={cn(
        "rounded-lg border border-surface-border bg-surface-card shadow-panel",
        interactive && "transition-colors hover:bg-surface-hover",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
