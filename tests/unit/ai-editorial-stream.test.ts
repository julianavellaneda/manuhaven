import { describe, expect, it, vi } from "vitest";
import {
  progressFromEvent,
  progressLabel,
  progressPercent,
  readEditorialSSE,
} from "@/lib/ai/editorial-stream";

function streamOf(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe("progressFromEvent", () => {
  it("maps start and chapter events onto the chapters phase", () => {
    expect(progressFromEvent({ type: "start", totalChapters: 12 })).toEqual({
      phase: "chapters",
      completed: 0,
      total: 12,
    });
    expect(
      progressFromEvent({ type: "chapter", index: 3, total: 12, title: "Dusk" })
    ).toEqual({ phase: "chapters", completed: 3, total: 12, lastTitle: "Dusk" });
  });

  it("maps synthesizing and style events", () => {
    expect(progressFromEvent({ type: "synthesizing" })).toEqual({
      phase: "synthesizing",
    });
    expect(progressFromEvent({ type: "style" })).toEqual({ phase: "style" });
  });

  it("ignores unknown events", () => {
    expect(
      progressFromEvent({ type: "other" } as unknown as Parameters<
        typeof progressFromEvent
      >[0])
    ).toBeNull();
  });
});

describe("progressLabel / progressPercent", () => {
  it("labels each phase", () => {
    expect(progressLabel({ phase: "idle" })).toBe("");
    expect(progressLabel({ phase: "starting" })).toBe("Starting analysis…");
    expect(
      progressLabel({ phase: "chapters", completed: 2, total: 5 })
    ).toBe("Analyzing chapters (2/5)");
    expect(
      progressLabel({ phase: "chapters", completed: 2, total: 5, lastTitle: "Dawn" })
    ).toBe("Analyzing chapters (2/5) — Dawn");
    expect(progressLabel({ phase: "synthesizing" })).toBe("Synthesizing report…");
    expect(progressLabel({ phase: "style" })).toBe("Running style analysis…");
  });

  it("scales chapter progress between 5 and 80 percent", () => {
    expect(progressPercent({ phase: "idle" })).toBe(0);
    expect(progressPercent({ phase: "starting" })).toBe(4);
    expect(progressPercent({ phase: "chapters", completed: 0, total: 4 })).toBe(5);
    expect(progressPercent({ phase: "chapters", completed: 2, total: 4 })).toBe(43);
    expect(progressPercent({ phase: "chapters", completed: 4, total: 4 })).toBe(80);
    expect(progressPercent({ phase: "chapters", completed: 0, total: 0 })).toBe(5);
    expect(progressPercent({ phase: "synthesizing" })).toBe(88);
    expect(progressPercent({ phase: "style" })).toBe(96);
  });
});

describe("readEditorialSSE", () => {
  it("dispatches progress, done and error events", async () => {
    const onProgress = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    await readEditorialSSE(
      streamOf(
        'event: progress\ndata: {"type":"synthesizing"}\n\n' +
          'event: done\ndata: {"report":{"overallScore":80},"style":null}\n\n' +
          'event: error\ndata: {"error":"boom"}\n\n' +
          "event: error\ndata: {}\n\n"
      ),
      { onProgress, onDone, onError }
    );
    expect(onProgress).toHaveBeenCalledWith({ type: "synthesizing" });
    expect(onDone).toHaveBeenCalledWith({
      report: { overallScore: 80 },
      style: null,
    });
    expect(onError.mock.calls).toEqual([["boom"], ["Unknown error"]]);
  });
});
