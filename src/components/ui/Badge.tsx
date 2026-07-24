import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

type BadgeTone = "neutral" | "strong" | "success" | "warning" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone | undefined;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-surface-border bg-surface-base text-ink-secondary",
  strong: "border-white bg-white text-surface-base",
  success: "border-white/70 bg-white text-surface-base",
  warning: "border-surface-border bg-surface-hover text-ink-primary",
  error: "border-white bg-surface-card text-ink-primary"
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-md border px-2 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
