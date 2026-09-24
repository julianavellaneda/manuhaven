"use client";

import { useState } from "react";
import { Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { readSSEStream } from "@/lib/ai/sse-client";
import type {
  EditorialReport,
  StyleAnalysis,
} from "@/lib/ai/editorial";

interface Props {
  projectId: string;
  savedReport: EditorialReport | null;
  savedStyle: StyleAnalysis | null;
}

type ProgressState =
  | { phase: "idle" }
  | { phase: "starting" }
  | {
      phase: "chapters";
      completed: number;
      total: number;
      lastTitle?: string;
    }
  | { phase: "synthesizing" }
  | { phase: "style" };

function progressLabel(p: ProgressState): string {
  switch (p.phase) {
    case "idle":
      return "";
    case "starting":
      return "Starting analysis…";
    case "chapters":
      return p.lastTitle
        ? `Analyzing chapters (${p.completed}/${p.total}) — ${p.lastTitle}`
        : `Analyzing chapters (${p.completed}/${p.total})`;
    case "synthesizing":
      return "Synthesizing report…";
    case "style":
      return "Running style analysis…";
  }
}

function progressPercent(p: ProgressState): number {
  switch (p.phase) {
    case "idle":
      return 0;
    case "starting":
      return 4;
    case "chapters":
      return 5 + Math.round((p.completed / Math.max(1, p.total)) * 75);
    case "synthesizing":
      return 88;
    case "style":
      return 96;
  }
}

export function EditorialReport({
  projectId,
  savedReport,
  savedStyle,
}: Props) {
  const [report, setReport] = useState<EditorialReport | null>(savedReport);
  const [style, setStyle] = useState<StyleAnalysis | null>(savedStyle);
  const [progress, setProgress] = useState<ProgressState>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const isRunning = progress.phase !== "idle";

  async function handleGenerate() {
    setError(null);
    setProgress({ phase: "starting" });
    try {
      const res = await fetch("/api/ai/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to start editorial report");
      }
      await readEditorialSSE(res.body, {
        onProgress: (ev) => {
          if (ev.type === "start") {
            setProgress({
              phase: "chapters",
              completed: 0,
              total: ev.totalChapters,
            });
          } else if (ev.type === "chapter") {
            setProgress({
              phase: "chapters",
              completed: ev.index,
              total: ev.total,
              lastTitle: ev.title,
            });
          } else if (ev.type === "synthesizing") {
            setProgress({ phase: "synthesizing" });
          } else if (ev.type === "style") {
            setProgress({ phase: "style" });
          }
        },
        onDone: ({ report: r, style: s }) => {
          setReport(r);
          setStyle(s);
          setProgress({ phase: "idle" });
        },
        onError: (msg) => {
          setError(msg);
          setProgress({ phase: "idle" });
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setProgress({ phase: "idle" });
    }
  }


  return (
    <div className="space-y-6 print:space-y-3">
      <Card className="p-6 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="size-4 text-primary" />
              AI Editorial Suite
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Two-pass analysis of pacing, character arcs, plot structure, prose
              quality, and style. Includes the Story Bible (continuity tracker).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="size-4" />
                Print
              </Button>
            )}
            <Button onClick={handleGenerate} disabled={isRunning}>
              {isRunning
                ? "Analyzing…"
                : report
                  ? "Regenerate"
                  : "Generate Report"}
            </Button>
          </div>
        </div>

        {isRunning && (
          <div className="mt-4 space-y-2">
            <Progress value={progressPercent(progress)} />
            <p className="text-xs text-muted-foreground">
              {progressLabel(progress)}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </Card>

      {report ? (
        <ReportTabs report={report} style={style} />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground print:hidden">
          No report yet. Click Generate Report to begin.
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report tabs
// ---------------------------------------------------------------------------

function ReportTabs({
  report,
  style,
}: {
  report: EditorialReport;
  style: StyleAnalysis | null;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="print:hidden">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="pacing">Pacing</TabsTrigger>
        <TabsTrigger value="characters">Characters</TabsTrigger>
        <TabsTrigger value="plot">Plot</TabsTrigger>
        <TabsTrigger value="prose">Prose</TabsTrigger>
        {style && <TabsTrigger value="style">Style</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="print:!block">
        <OverviewTab report={report} />
      </TabsContent>
      <TabsContent value="pacing" className="print:!block">
        <PacingTab report={report} />
      </TabsContent>
      <TabsContent value="characters" className="print:!block">
        <CharactersTab report={report} />
      </TabsContent>
      <TabsContent value="plot" className="print:!block">
        <PlotTab report={report} />
      </TabsContent>
      <TabsContent value="prose" className="print:!block">
        <ProseTab report={report} />
      </TabsContent>
      {style && (
        <TabsContent value="style" className="print:!block">
          <StyleTab style={style} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function ScoreBadge({ value, label }: { value: number; label: string }) {
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

function OverviewTab({ report }: { report: EditorialReport }) {
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

function PacingTab({ report }: { report: EditorialReport }) {
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

function CharactersTab({ report }: { report: EditorialReport }) {
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

function PlotTab({ report }: { report: EditorialReport }) {
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

function ProseTab({ report }: { report: EditorialReport }) {
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

function StyleTab({ style }: { style: StyleAnalysis }) {
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

// ---------------------------------------------------------------------------
// SSE event mapping (transport lives in lib/ai/sse-client.ts)
// ---------------------------------------------------------------------------

interface SSECallbacks {
  onProgress: (
    ev:
      | { type: "start"; totalChapters: number }
      | { type: "chapter"; index: number; total: number; title: string }
      | { type: "synthesizing" }
      | { type: "style" }
  ) => void;
  onDone: (payload: {
    report: EditorialReport;
    style: StyleAnalysis;
  }) => void;
  onError: (message: string) => void;
}

async function readEditorialSSE(
  body: ReadableStream<Uint8Array>,
  cb: SSECallbacks
): Promise<void> {
  await readSSEStream(body, (event, data) => {
    if (event === "progress") {
      cb.onProgress(data as Parameters<SSECallbacks["onProgress"]>[0]);
    } else if (event === "done") {
      cb.onDone(data as Parameters<SSECallbacks["onDone"]>[0]);
    } else if (event === "error") {
      const msg =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : "Unknown error";
      cb.onError(msg);
    }
  });
}
