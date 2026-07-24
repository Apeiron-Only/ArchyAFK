import { cn } from "../../utils/cn";

interface SwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ label, checked, onCheckedChange }: SwitchProps): JSX.Element {
  return (
    <button
      aria-pressed={checked}
      className="flex w-full items-center justify-between rounded-md border border-surface-border bg-surface-card px-3 py-2 text-left outline-none transition hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-white/50"
      type="button"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="text-sm font-medium text-ink-primary">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition",
          checked ? "border-white bg-white" : "border-surface-border bg-surface-base"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition",
            checked ? "left-[18px] bg-surface-base" : "left-1 bg-ink-secondary"
          )}
        />
      </span>
    </button>
  );
}
