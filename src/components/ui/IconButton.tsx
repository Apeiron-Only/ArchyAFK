import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  active?: boolean | undefined;
}

export function IconButton({
  icon: Icon,
  label,
  active = false,
  className,
  type = "button",
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      type={type}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-transparent text-ink-secondary outline-none transition duration-150 hover:bg-surface-hover hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-white/50",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-secondary",
        active && "border-surface-border bg-surface-hover text-ink-primary",
        className
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
