import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AIAPIError,
  InvalidResponseError,
  RateLimitError,
} from "@/lib/ai/errors";
import { chunkByChapter } from "@/lib/ai/chunk-by-chapter";
import { StoryBibleSchema } from "@/lib/ai/continuity";
import {
  buildModelMessages,
  buildSystemBlocks,
  type AssistantHistoryEntry,
} from "@/lib/ai/assistant/context-builder";
import { streamAssistantChat } from "@/lib/ai/assistant/chat";
import { resolveModelForUser } from "@/lib/ai/assistant/models";
import { NoAIKeyConfiguredError } from "@/lib/ai/errors";
import { generateConversationTitle } from "@/lib/ai/assistant/title";
import { buildAssistantTools } from "@/lib/ai/assistant/tools";
import type { AssistantToolCallRecord } from "@/lib/ai/assistant/types";
import { AI_THROTTLED_BODY, enforceAiThrottle } from "@/lib/ai/throttle";
import { getSessionUser } from "@/lib/auth/session";
import { completeUsageEvent } from "@/lib/db/queries/ai-usage";
import {
  createConversation,
  getConversation,
  insertMessage,
  listMessages,
  setConversationTitleIfUnset,
  touchConversation,
} from "@/lib/db/queries/assistant";
import { getManuscript } from "@/lib/db/queries/manuscripts";
import { getOwnedProject } from "@/lib/db/queries/projects";

// Tool loops legitimately run for tens of seconds (spec: architecture.md §4).
export const maxDuration = 120;

const bodySchema = z.object({
  projectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4_000),
  locale: z.enum(["en", "es"]).default("en"),
  context: z
    .object({
      chapterIndex: z.number().int().min(1).optional(),
    })
    .optional(),
});

type AssistantSSEFrame =
  | { event: "meta"; data: { conversationId: string } }
  | { event: "text_delta"; data: { text: string } }
  | {
      event: "tool_call";
      data: { id: string; name: string; input: Record<string, unknown> };
    }
  | {
      event: "tool_result";
      data: { id: string; name: string; meta: Record<string, unknown> };
    }
  | {
      event: "done";
      data: {
        conversationId: string;
        usage: { inputTokens: number; outputTokens: number };
      };
    }
  | {
      event: "error";
      data: { error: string; code?: string; status?: number; detail?: string };
    };

function encodeSSE(frame: AssistantSSEFrame): string {
  return `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { projectId, conversationId, message, locale, context } = parsed.data;

  const project = await getOwnedProject(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Resolve the model up front: with no key configured this is a plain 409
  // rather than an error event inside an already-open SSE stream, and it
  // costs the user none of their throttle budget.
  try {
    await resolveModelForUser(user.id, "chat");
  } catch (err) {
    if (err instanceof NoAIKeyConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    throw err;
  }

  // Claimed before the model runs; token columns are filled in on completion.
  const usageEventId = await enforceAiThrottle(
    user.id,
    projectId,
    "assistant_chat"
  );
  if (!usageEventId) {
    return NextResponse.json(AI_THROTTLED_BODY, { status: 429 });
  }

  const manuscript = await getManuscript(user.id, projectId);
  if (!manuscript?.tiptapJson) {
    return NextResponse.json(
      { error: "No manuscript to chat about", code: "no_manuscript" },
      { status: 404 }
    );
  }

  const chapters = chunkByChapter(manuscript.tiptapJson, 1_000_000);
  // An untouched editor stores an empty doc, which chunks to nothing: there is
  // no book to ground an answer in, so bill nothing and show the same copy.
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "No manuscript to chat about", code: "no_manuscript" },
      { status: 404 }
    );
  }
  const bibleParse = StoryBibleSchema.safeParse(manuscript.storyBible);
  const storyBible = bibleParse.success ? bibleParse.data : null;

  let activeConversationId: string;
  let conversationTitle: string | null = null;
  if (conversationId) {
    const conversation = await getConversation(
      user.id,
      conversationId,
      projectId
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    activeConversationId = conversation.id;
    conversationTitle = conversation.title;
  } else {
    try {
      activeConversationId = await createConversation(user.id, projectId);
    } catch {
      console.error("[ai/assistant] failed to create conversation", {
        projectId,
      });
      return NextResponse.json(
        { error: "Failed to start conversation" },
        { status: 500 }
      );
    }
  }

  const history: AssistantHistoryEntry[] = [];
  if (conversationId) {
    const rows = await listMessages(user.id, activeConversationId, 20);
    for (const row of rows) {
      const text =
        row.content &&
        typeof row.content === "object" &&
        typeof (row.content as { text?: unknown }).text === "string"
          ? ((row.content as { text: string }).text)
          : null;
      if ((row.role === "user" || row.role === "assistant") && text) {
        history.push({ role: row.role, text });
      }
    }
  }

  // A driver error can quote the row, i.e. the user's message: never log it.
  const userMessageSaved = await insertMessage(user.id, activeConversationId, {
    role: "user",
    content: { text: message },
  }).catch(() => false);
  if (!userMessageSaved) {
    console.error("[ai/assistant] failed to persist user message", {
      projectId,
    });
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }

  const system = buildSystemBlocks({
    projectTitle: project.title,
    genre: project.genre,
    chapters,
    storyBible,
    locale,
    mode: "editorial",
  });
  const chapterTitle = context?.chapterIndex
    ? chapters.find((c) => c.index === context.chapterIndex)?.title
    : undefined;
  const messages = buildModelMessages({
    history,
    message,
    turnContext: context?.chapterIndex
      ? { chapterIndex: context.chapterIndex, chapterTitle }
      : undefined,
  });
  const tooling = buildAssistantTools({
    chapters,
    storyBible,
    mode: "editorial",
  });

  const isDev = process.env.NODE_ENV !== "production";
  const encoder = new TextEncoder();
  const streamConversationId = activeConversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (frame: AssistantSSEFrame) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(frame)));
        } catch {
          closed = true;
        }
      };

      send({ event: "meta", data: { conversationId: streamConversationId } });

      try {
        let final: {
          text: string;
          toolCalls: AssistantToolCallRecord[];
          usage: { inputTokens: number; outputTokens: number };
          model: string;
          latencyMs: number;
        } | null = null;

        for await (const ev of streamAssistantChat({
          userId: user.id,
          system,
          messages,
          tooling,
          abortSignal: request.signal,
        })) {
          switch (ev.type) {
            case "text_delta":
              send({ event: "text_delta", data: { text: ev.text } });
              break;
            case "tool_call":
              send({
                event: "tool_call",
                data: { id: ev.id, name: ev.name, input: ev.input },
              });
              break;
            case "tool_result":
              send({
                event: "tool_result",
                data: { id: ev.id, name: ev.name, meta: ev.meta },
              });
              break;
            case "done":
              final = ev;
              break;
          }
        }

        if (!final) {
          // Client aborted mid-stream: the partial assistant message is
          // discarded by design (spec: architecture.md §5).
          controller.close();
          return;
        }

        const replySaved = await insertMessage(user.id, streamConversationId, {
          role: "assistant",
          content: { text: final.text },
          toolCalls: final.toolCalls.length > 0 ? final.toolCalls : null,
          inputTokens: final.usage.inputTokens,
          outputTokens: final.usage.outputTokens,
          model: final.model,
        }).catch(() => false);
        if (!replySaved) {
          console.error("[ai/assistant] failed to persist assistant message", {
            projectId,
          });
          send({
            event: "error",
            data: { error: "Failed to save the reply", status: 500 },
          });
          controller.close();
          return;
        }

        try {
          await completeUsageEvent(user.id, usageEventId, {
            model: final.model,
            inputTokens: final.usage.inputTokens,
            outputTokens: final.usage.outputTokens,
            latencyMs: final.latencyMs,
          });
        } catch {
          console.error("[ai/assistant] failed to record usage", { projectId });
        }

        // Only affects sort order; never fail a saved turn over it.
        await touchConversation(user.id, streamConversationId).catch(() => {});

        send({
          event: "done",
          data: {
            conversationId: streamConversationId,
            usage: {
              inputTokens: final.usage.inputTokens,
              outputTokens: final.usage.outputTokens,
            },
          },
        });

        // Close before titling: the client's composer stays disabled until the
        // stream ends, and titling is a second model call the reply never
        // needs to wait on.
        closed = true;
        controller.close();

        if (!conversationTitle) {
          try {
            const title = await generateConversationTitle(message, locale, user.id);
            if (title) {
              // Only the first turn to finish names the conversation.
              await setConversationTitleIfUnset(
                user.id,
                streamConversationId,
                title
              );
            }
          } catch {
            // Titling is cosmetic — never fail the turn over it.
          }
        }
      } catch (err) {
        const errorName = err instanceof Error ? err.name : "UnknownError";
        // Only for the dev-mode response detail: never log it, it can quote
        // model output derived from the manuscript.
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[ai/assistant] chat failed", { projectId, errorName });

        let status = 500;
        let messageOut = "The assistant hit a snag; please try again";
        let code = "stream_error";
        if (err instanceof RateLimitError) {
          status = 503;
          messageOut = "AI provider rate limit; try again shortly";
          code = "provider_rate_limited";
        } else if (err instanceof InvalidResponseError) {
          status = 502;
          messageOut = "AI returned an invalid response; please try again";
        } else if (err instanceof AIAPIError) {
          status = 502;
          messageOut = "AI provider error";
        }
        send({
          event: "error",
          data: {
            error: messageOut,
            code,
            status,
            ...(isDev && { detail: errorMessage }),
          },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
