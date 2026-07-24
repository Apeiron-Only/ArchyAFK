import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | undefined;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-white bg-white text-surface-base hover:bg-ink-secondary",
  secondary: "border-surface-border bg-surface-card text-ink-primary hover:bg-surface-hover",
  ghost:
    "border-transparent bg-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink-primary",
  danger:
    "border-surface-border bg-surface-card text-ink-primary hover:border-white hover:bg-white hover:text-surface-base"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-2 px-3 text-xs",
  md: "h-10 gap-2.5 px-4 text-sm"
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-medium outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled === true || loading}
      type={type}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {!loading && Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
