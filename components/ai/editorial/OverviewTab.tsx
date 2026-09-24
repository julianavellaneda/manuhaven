import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EditorialReport } from "@/lib/ai/editorial";
import { ScoreBadge } from "./ScoreBadge";

export function OverviewTab({ report }: { report: EditorialReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-8">
          <ScoreBadge value={report.overallScore} label="Overall" />
          <ScoreBadge value={report.pacing.score} label="Pacing" />
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Strengths
        </h3>
        <ul className="space-y-2 text-sm">
          {report.strengths.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">✓</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Top Suggestions
        </h3>
        <ul className="space-y-2 text-sm">
          {report.suggestions.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[0.65rem] font-medium uppercase",
                  s.priority === "high"
                    ? "bg-destructive/15 text-destructive"
                    : s.priority === "medium"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {s.priority}
              </span>
              <span className="text-muted-foreground">Ch. {s.chapter}</span>
              <span className="flex-1">{s.description}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
