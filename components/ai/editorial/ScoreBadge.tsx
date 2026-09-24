import { cn } from "@/lib/utils";

export function ScoreBadge({ value, label }: { value: number; label: string }) {
  const tone =
    value >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : value >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  return (
    <div className="flex flex-col items-start">
      <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-3xl font-semibold tabular-nums", tone)}>
        {value}
      </span>
    </div>
  );
}
