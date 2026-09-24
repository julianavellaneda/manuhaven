import { describe, expect, it } from "vitest";
import { readSSEStream } from "@/lib/ai/sse-client";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("readSSEStream", () => {
  it("dispatches events in order", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const body = streamFromChunks([
      'event: text_delta\ndata: {"text":"Hello"}\n\n',
      'event: done\ndata: {"ok":true}\n\n',
    ]);
    await readSSEStream(body, (event, data) => events.push({ event, data }));
    expect(events).toEqual([
      { event: "text_delta", data: { text: "Hello" } },
      { event: "done", data: { ok: true } },
    ]);
  });

  it("handles frames split across chunk boundaries", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const body = streamFromChunks([
      "event: text_del",
      'ta\ndata: {"text":"Hel',
      'lo"}\n\nevent: done\nda',
      'ta: {"ok":true}\n\n',
    ]);
    await readSSEStream(body, (event, data) => events.push({ event, data }));
    expect(events).toEqual([
      { event: "text_delta", data: { text: "Hello" } },
      { event: "done", data: { ok: true } },
    ]);
  });

  it("skips blocks with unparseable JSON and no data", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const body = streamFromChunks([
      "event: broken\ndata: {not json}\n\n",
      ": comment only\n\n",
      'event: ok\ndata: {"n":1}\n\n',
    ]);
    await readSSEStream(body, (event, data) => events.push({ event, data }));
    expect(events).toEqual([{ event: "ok", data: { n: 1 } }]);
  });

  it("defaults the event name to message", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const body = streamFromChunks(['data: {"n":2}\n\n']);
    await readSSEStream(body, (event, data) => events.push({ event, data }));
    expect(events).toEqual([{ event: "message", data: { n: 2 } }]);
  });
});
