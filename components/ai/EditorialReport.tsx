"use client";

import { Printer, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  EditorialReport,
  StyleAnalysis,
} from "@/lib/ai/editorial";
import { progressLabel, progressPercent } from "@/lib/ai/editorial-stream";
import { NoAiKeyNotice } from "./NoAiKeyNotice";
import { ReportTabs } from "./editorial/ReportTabs";
import { useEditorialReport } from "./use-editorial-report";

interface Props {
  projectId: string;
  savedReport: EditorialReport | null;
  savedStyle: StyleAnalysis | null;
}

export function EditorialReport({
  projectId,
  savedReport,
  savedStyle,
}: Props) {
  const { report, style, progress, error, errorCode, isRunning, generate } =
    useEditorialReport(projectId, savedReport, savedStyle);
  const t = useTranslations("pages.projectEditorial.noKey");

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
            <Button onClick={generate} disabled={isRunning}>
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

        {errorCode === "no_ai_key" ? (
          <div className="mt-4">
            <NoAiKeyNotice
              title={t("title")}
              body={t("body")}
              cta={t("cta")}
            />
          </div>
        ) : (
          error && (
            <p className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )
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
