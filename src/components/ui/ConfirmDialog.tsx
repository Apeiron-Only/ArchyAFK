import { AlertTriangle } from "lucide-react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog open={open} title={title} onClose={onCancel} widthClassName="max-w-md">
      <div className="grid gap-5 p-5">
        <div className="flex gap-3">
          <div className="grid size-10 place-items-center rounded-md border border-surface-border bg-surface-base">
            <AlertTriangle className="size-5 text-ink-primary" aria-hidden="true" />
          </div>
          <p className="text-sm leading-6 text-ink-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
