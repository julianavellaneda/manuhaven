import { z } from "zod";
import { GENRES, type Genre } from "@/lib/constants";
import {
  generateEditorialReport,
  type EditorialProgressEvent,
} from "@/lib/ai/editorial";
import {
  AIAPIError,
  InputTooShortError,
  InvalidResponseError,
  NoAIKeyConfiguredError,
  RateLimitError,
} from "@/lib/ai/errors";
import { preflightAI } from "@/lib/ai/preflight";
import { AI_THROTTLED_BODY, enforceAiThrottle } from "@/lib/ai/throttle";
import { getSessionUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/db/queries/projects";
import {
  claimAiCooldown,
  getManuscript,
  releaseAiCooldown,
  updateManuscriptAi,
  type AiCooldownClaim,
} from "@/lib/db/queries/manuscripts";

const bodySchema = z.object({
  projectId: z.string().uuid(),
});

const RATE_LIMIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SSEEvent =
  | { event: "progress"; data: EditorialProgressEvent }
  | { event: "done"; data: { report: unknown; style: unknown } }
  | {
      event: "error";
      data: { error: string; status?: number; code?: string };
    };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function encodeSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Invalid request", details: parsed.error.issues },
      400
    );
  }
  const { projectId } = parsed.data;

  const project = await getOwnedProject(user.id, projectId);
  if (!project) return jsonResponse({ error: "Project not found" }, 404);

  const manuscript = await getManuscript(user.id, projectId);
  if (!manuscript?.tiptapJson) {
    return jsonResponse(
      { error: "No manuscript found for this project" },
      400
    );
  }

  let cooldownApplies: boolean;
  try {
    ({ cooldownApplies } = await preflightAI(user.id));
  } catch (err) {
    if (err instanceof NoAIKeyConfiguredError) {
      return jsonResponse({ error: err.message, code: err.code }, 409);
    }
    throw err;
  }

  const usageEventId = await enforceAiThrottle(user.id, projectId, "editorial");
  if (!usageEventId) return jsonResponse(AI_THROTTLED_BODY, 429);

  // Stamped before generating, under a row lock, so parallel requests can't
  // all slip through the window. Released again if generation fails.
  let cooldown: AiCooldownClaim | null = null;
  if (cooldownApplies) {
    cooldown = await claimAiCooldown(
      user.id,
      projectId,
      "lastAiEditorialAt",
      RATE_LIMIT_WINDOW_MS
    );
    if (cooldown && !cooldown.ok) {
      const retryAfterSeconds = Math.ceil(
        (cooldown.retryAt.getTime() - Date.now()) / 1000
      );
      return jsonResponse(
        {
          error: "Rate limit exceeded; try again in 7 days",
          retryAfterSeconds,
        },
        429
      );
    }
  }
  const releaseCooldown = async () => {
    if (cooldown?.ok) {
      await releaseAiCooldown(
        user.id,
        projectId,
        "lastAiEditorialAt",
        cooldown
      ).catch(() => undefined);
    }
  };

  const genre: Genre = (GENRES as readonly string[]).includes(
    project.genre ?? ""
  )
    ? (project.genre as Genre)
    : "other";

  const tiptapJson = manuscript.tiptapJson;
  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };

      try {
        const { report, style } = await generateEditorialReport({
          userId: user.id,
          tiptapJson,
          genre,
          onProgress: (ev) => send({ event: "progress", data: ev }),
        });

        // A driver error can quote the row, i.e. manuscript text: never log it.
        const saved = await updateManuscriptAi(user.id, projectId, {
          editorialReport: report,
          styleAnalysis: style,
          lastAiEditorialAt: new Date(),
        }).catch(() => false);

        if (!saved) {
          console.error("[ai/editorial] failed to persist", { projectId });
          send({
            event: "error",
            data: {
              error: "Failed to persist editorial report",
              status: 500,
            },
          });
          controller.close();
          return;
        }

        console.log("[ai/editorial] generated", {
          projectId,
          genre,
          latencyMs: Date.now() - started,
        });

        send({ event: "done", data: { report, style } });
        controller.close();
      } catch (err) {
        await releaseCooldown();
        // Only for the dev-mode response detail: never log it, it can quote
        // model output derived from the manuscript.
        const errorMessage = err instanceof Error ? err.message : "unknown";
        console.error("[ai/editorial] failed", {
          projectId,
          genre,
          latencyMs: Date.now() - started,
          errorName: err instanceof Error ? err.name : "unknown",
        });

        const isDev = process.env.NODE_ENV !== "production";
        let status = 500;
        let message = "Failed to generate editorial report";
        let code: string | undefined;
        if (err instanceof NoAIKeyConfiguredError) {
          status = 409;
          message = err.message;
          code = err.code;
        } else if (err instanceof InputTooShortError) {
          status = 400;
          message = err.message;
        } else if (err instanceof RateLimitError) {
          status = 503;
          message = "AI provider rate limit; try again shortly";
        } else if (err instanceof InvalidResponseError) {
          status = 502;
          message = "AI returned an invalid response; please try again";
        } else if (err instanceof AIAPIError) {
          status = 502;
          message = "AI provider error";
        }
        send({
          event: "error",
          data: {
            error: message,
            status,
            ...(code && { code }),
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
