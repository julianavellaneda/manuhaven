import { Card } from "@/components/ui/card";
import type { EditorialReport } from "@/lib/ai/editorial";
import { ScoreBadge } from "./ScoreBadge";

export function CharactersTab({ report }: { report: EditorialReport }) {
  return (
    <Card className="p-6">
      {report.characterArcs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No character arcs were extracted.
        </p>
      ) : (
        <div className="space-y-5">
          {report.characterArcs.map((c, i) => (
            <div key={i} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{c.character}</h3>
                <ScoreBadge value={c.consistency} label="Consistency" />
              </div>
              <p className="text-sm">{c.arc}</p>
              {c.issues.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {c.issues.map((iss, j) => (
                    <li key={j}>• {iss}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
