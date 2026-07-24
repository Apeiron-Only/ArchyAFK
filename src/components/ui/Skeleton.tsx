import { cn } from "../../utils/cn";

interface SkeletonProps {
  className?: string | undefined;
}

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return <div className={cn("animate-pulse rounded-md bg-surface-hover", className)} />;
}
