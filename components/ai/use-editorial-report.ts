"use client";

import { useState } from "react";
import type { EditorialReport, StyleAnalysis } from "@/lib/ai/editorial";
import {
  progressFromEvent,
  readEditorialSSE,
  type ProgressState,
} from "@/lib/ai/editorial-stream";

/**
 * Report/style state plus the streaming "generate" request. Any non-OK
 * response (including 409 `no_ai_key`) surfaces the route's `error` message.
 */
export function useEditorialReport(
  projectId: string,
  savedReport: EditorialReport | null,
  savedStyle: StyleAnalysis | null
) {
  const [report, setReport] = useState<EditorialReport | null>(savedReport);
  const [style, setStyle] = useState<StyleAnalysis | null>(savedStyle);
  const [progress, setProgress] = useState<ProgressState>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const isRunning = progress.phase !== "idle";

  async function generate() {
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
          const next = progressFromEvent(ev);
          if (next) setProgress(next);
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

  return { report, style, progress, error, isRunning, generate };
}
