import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

import { cn } from "../../utils/cn";

interface FieldFrameProps {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}

export function FieldFrame({ label, error, children }: FieldFrameProps): JSX.Element {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-ink-primary">{label}</span>
      {children}
      {error ? <span className="text-xs text-ink-secondary">{error}</span> : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean | undefined;
}

export function Input({ className, invalid = false, ...props }: InputProps): JSX.Element {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border bg-surface-base px-3 text-sm text-ink-primary outline-none transition placeholder:text-ink-secondary/70 focus:border-white focus:ring-2 focus:ring-white/10",
        invalid ? "border-white" : "border-surface-border",
        className
      )}
      {...props}
    />
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean | undefined;
}

export function Textarea({ className, invalid = false, ...props }: TextareaProps): JSX.Element {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none rounded-md border bg-surface-base px-3 py-2 text-sm text-ink-primary outline-none transition placeholder:text-ink-secondary/70 focus:border-white focus:ring-2 focus:ring-white/10",
        invalid ? "border-white" : "border-surface-border",
        className
      )}
      {...props}
    />
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  invalid?: boolean | undefined;
}

export function Select({
  className,
  options,
  invalid = false,
  ...props
}: SelectProps): JSX.Element {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border bg-surface-base px-3 text-sm text-ink-primary outline-none transition focus:border-white focus:ring-2 focus:ring-white/10",
        invalid ? "border-white" : "border-surface-border",
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
