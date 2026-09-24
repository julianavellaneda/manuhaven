import { readSSEStream } from "@/lib/ai/sse-client";
import type { EditorialReport, StyleAnalysis } from "@/lib/ai/editorial";

/**
 * Browser-side view of the editorial report stream from /api/ai/editorial:
 * the progress events it emits, how they map onto the progress bar, and the
 * SSE event mapping (transport lives in lib/ai/sse-client.ts).
 */

export type EditorialProgressEvent =
  | { type: "start"; totalChapters: number }
  | { type: "chapter"; index: number; total: number; title: string }
  | { type: "synthesizing" }
  | { type: "style" };

export type ProgressState =
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

/** Next progress state for a stream event; null leaves the state unchanged. */
export function progressFromEvent(
  ev: EditorialProgressEvent
): ProgressState | null {
  if (ev.type === "start") {
    return { phase: "chapters", completed: 0, total: ev.totalChapters };
  } else if (ev.type === "chapter") {
    return {
      phase: "chapters",
      completed: ev.index,
      total: ev.total,
      lastTitle: ev.title,
    };
  } else if (ev.type === "synthesizing") {
    return { phase: "synthesizing" };
  } else if (ev.type === "style") {
    return { phase: "style" };
  }
  return null;
}

export function progressLabel(p: ProgressState): string {
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

export function progressPercent(p: ProgressState): number {
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

interface SSECallbacks {
  onProgress: (ev: EditorialProgressEvent) => void;
  onDone: (payload: {
    report: EditorialReport;
    style: StyleAnalysis;
  }) => void;
  onError: (message: string) => void;
}

export async function readEditorialSSE(
  body: ReadableStream<Uint8Array>,
  cb: SSECallbacks
): Promise<void> {
  await readSSEStream(body, (event, data) => {
    if (event === "progress") {
      cb.onProgress(data as EditorialProgressEvent);
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
