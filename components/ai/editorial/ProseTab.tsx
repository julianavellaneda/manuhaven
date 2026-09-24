import { Card } from "@/components/ui/card";
import type { EditorialReport } from "@/lib/ai/editorial";

export function ProseTab({ report }: { report: EditorialReport }) {
  const slv = report.proseQuality.sentenceLengthVariation;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Adverb density
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {report.proseQuality.adverbDensity.toFixed(2)}
            <span className="ml-1 text-xs text-muted-foreground">
              per 100 words
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Mean sentence length
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {slv.mean.toFixed(1)}
            <span className="ml-1 text-xs text-muted-foreground">words</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Sentence-length stddev
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {slv.stddev.toFixed(1)}
          </p>
        </Card>
      </div>
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Overused words
        </h3>
        {report.proseQuality.overusedWords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notable repetition.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {report.proseQuality.overusedWords.map((w, i) => (
              <li key={i}>
                <span className="font-medium">{w.word}</span>{" "}
                <span className="text-muted-foreground">(×{w.count})</span> —{" "}
                {w.suggestion}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
          Dialogue tag variety
        </h3>
        {report.proseQuality.dialogueTagVariety.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dialogue tag data.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {report.proseQuality.dialogueTagVariety.map((t, i) => (
              <li
                key={i}
                className="rounded-full border bg-muted/30 px-3 py-1 text-xs"
              >
                {t.tag} ×{t.count}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {slv.monotonousSections.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Monotonous rhythm sections
          </h3>
          <ul className="space-y-2 text-sm">
            {slv.monotonousSections.map((s, i) => (
              <li key={i}>
                <span className="font-medium">Ch. {s.chapter}:</span>{" "}
                {s.description}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
