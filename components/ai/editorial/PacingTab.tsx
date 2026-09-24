import { Card } from "@/components/ui/card";
import type { EditorialReport } from "@/lib/ai/editorial";

export function PacingTab({ report }: { report: EditorialReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <p className="text-sm">{report.pacing.analysis}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Slow sections
          </h3>
          {report.pacing.slowSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">None flagged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.pacing.slowSections.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">Ch. {s.chapter}:</span>{" "}
                  {s.description}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Fast sections
          </h3>
          {report.pacing.fastSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">None flagged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.pacing.fastSections.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">Ch. {s.chapter}:</span>{" "}
                  {s.description}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
