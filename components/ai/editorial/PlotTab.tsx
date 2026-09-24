import { Card } from "@/components/ui/card";
import type { EditorialReport } from "@/lib/ai/editorial";

export function PlotTab({ report }: { report: EditorialReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Act breaks
        </h3>
        {report.plotStructure.actBreaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clear act breaks.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.plotStructure.actBreaks.map((a, i) => (
              <li key={i}>
                <span className="font-medium">Ch. {a.chapter}:</span>{" "}
                {a.description}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Plot holes
          </h3>
          {report.plotStructure.plotHoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">None detected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.plotStructure.plotHoles.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Unresolved threads
          </h3>
          {report.plotStructure.unresolved.length === 0 ? (
            <p className="text-sm text-muted-foreground">All threads land.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.plotStructure.unresolved.map((u, i) => (
                <li key={i}>• {u}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
