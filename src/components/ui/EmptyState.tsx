import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  action?: ReactNode | undefined;
}

export function EmptyState({ icon: Icon, title, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-surface-border bg-surface-card">
      <div className="grid justify-items-center gap-4">
        <div className="grid size-12 place-items-center rounded-md border border-surface-border bg-surface-base">
          <Icon className="size-5 text-ink-secondary" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-ink-secondary">{title}</p>
        {action}
      </div>
    </div>
  );
}
