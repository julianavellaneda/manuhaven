import { Card } from "@/components/ui/card";
import type { StyleAnalysis } from "@/lib/ai/editorial";
import { ScoreBadge } from "./ScoreBadge";

export function StyleTab({ style }: { style: StyleAnalysis }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-8">
          <ScoreBadge value={style.genreAlignment} label="Genre alignment" />
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
              Tone
            </p>
            <p className="mt-1 text-base font-semibold capitalize">
              {style.toneProfile.dominant}
              {style.toneProfile.secondary && (
                <span className="ml-2 text-muted-foreground">
                  + {style.toneProfile.secondary}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
              Reading level
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums">
              Grade {style.readingLevel.grade.toFixed(1)}{" "}
              <span className="ml-1 text-xs text-muted-foreground">
                ({style.readingLevel.comparison} genre norm)
              </span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Style markers
        </h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Marker label="Dialogue" value={style.styleMarkers.dialogueRatio} />
          <Marker
            label="Description"
            value={style.styleMarkers.descriptionDensity}
          />
          <Marker label="Action" value={style.styleMarkers.actionDensity} />
          <Marker
            label="Introspection"
            value={style.styleMarkers.introspectionDensity}
          />
        </div>
      </Card>

      {style.outlierPassages.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Outlier passages
          </h3>
          <ul className="space-y-3 text-sm">
            {style.outlierPassages.map((p, i) => (
              <li key={i} className="border-l-2 border-amber-500/40 pl-3">
                <p>
                  <span className="font-medium">
                    Ch. {p.chapter}, ¶ {p.startParagraph}:
                  </span>{" "}
                  {p.issue}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Suggestion: {p.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Marker({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
