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
 * response surfaces the route's `error` message, except 409 `no_ai_key`,
 * which is tracked separately in `errorCode` so the UI can show the
 * Settings → AI link instead of the raw message.
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
  const [errorCode, setErrorCode] = useState<"no_ai_key" | null>(null);
  const isRunning = progress.phase !== "idle";

  function fail(message: string, code?: string) {
    if (code === "no_ai_key") {
      setErrorCode("no_ai_key");
    } else {
      setError(message);
    }
    setProgress({ phase: "idle" });
  }

  async function generate() {
    setError(null);
    setErrorCode(null);
    setProgress({ phase: "starting" });
    try {
      const res = await fetch("/api/ai/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        if (body?.code === "no_ai_key") {
          fail(body.error, body.code);
          return;
        }
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
        onError: fail,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setProgress({ phase: "idle" });
    }
  }

  return { report, style, progress, error, errorCode, isRunning, generate };
}
