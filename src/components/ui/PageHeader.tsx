import type { LucideIcon } from "lucide-react";

import { Button } from "./Button";

interface PageHeaderAction {
  label: string;
  icon?: LucideIcon | undefined;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  eyebrow?: string | undefined;
  action?: PageHeaderAction | undefined;
  secondaryAction?: PageHeaderAction | undefined;
}

export function PageHeader({
  title,
  eyebrow,
  action,
  secondaryAction
}: PageHeaderProps): JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase text-ink-secondary">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-2xl font-semibold text-ink-primary">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {secondaryAction ? (
          <Button icon={secondaryAction.icon} variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
        {action ? (
          <Button icon={action.icon} variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
