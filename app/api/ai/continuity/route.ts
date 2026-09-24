import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStoryBible } from "@/lib/ai/continuity";
import { preflightAI } from "@/lib/ai/preflight";
import {
  AIAPIError,
  InputTooShortError,
  InvalidResponseError,
  RateLimitError,
  NoAIKeyConfiguredError,
} from "@/lib/ai/errors";
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

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  const { projectId } = parsed.data;

  const project = await getOwnedProject(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const manuscript = await getManuscript(user.id, projectId);
  if (!manuscript?.tiptapJson) {
    return NextResponse.json(
      { error: "No manuscript found for this project" },
      { status: 400 }
    );
  }

  let cooldownApplies: boolean;
  try {
    ({ cooldownApplies } = await preflightAI(user.id));
  } catch (err) {
    if (err instanceof NoAIKeyConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    throw err;
  }

  const usageEventId = await enforceAiThrottle(user.id, projectId, "continuity");
  if (!usageEventId) {
    return NextResponse.json(AI_THROTTLED_BODY, { status: 429 });
  }

  // Stamped before generating, under a row lock, so parallel requests can't
  // all slip through the window. Released again if generation fails.
  let cooldown: AiCooldownClaim | null = null;
  if (cooldownApplies) {
    cooldown = await claimAiCooldown(
      user.id,
      projectId,
      "lastAiContinuityAt",
      RATE_LIMIT_WINDOW_MS
    );
    if (cooldown && !cooldown.ok) {
      const retryAfterSeconds = Math.ceil(
        (cooldown.retryAt.getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: "Rate limit exceeded; try again in 24 hours",
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }
  }
  const releaseCooldown = async () => {
    if (cooldown?.ok) {
      await releaseAiCooldown(
        user.id,
        projectId,
        "lastAiContinuityAt",
        cooldown
      ).catch(() => undefined);
    }
  };

  const started = Date.now();
  try {
    const storyBible = await generateStoryBible({
      userId: user.id,
      tiptapJson: manuscript.tiptapJson,
    });

    // A driver error can quote the row, i.e. manuscript text: never log it.
    const saved = await updateManuscriptAi(user.id, projectId, {
      storyBible,
      lastAiContinuityAt: new Date(),
    }).catch(() => false);

    if (!saved) {
      console.error("[ai/continuity] failed to save story_bible", {
        projectId,
      });
      return NextResponse.json(
        { error: "Failed to persist Story Bible; please try again" },
        { status: 500 }
      );
    }

    console.log("[ai/continuity] generated", {
      projectId,
      latencyMs: Date.now() - started,
      characters: storyBible.characters.length,
      locations: storyBible.locations.length,
      inconsistencies: storyBible.inconsistencies.length,
    });

    return NextResponse.json({ storyBible });
  } catch (err) {
    await releaseCooldown();
    // Only for the dev-mode response detail: never log it, it can quote
    // model output derived from the manuscript.
    const errorMessage = err instanceof Error ? err.message : "unknown";
    console.error("[ai/continuity] failed", {
      projectId,
      latencyMs: Date.now() - started,
      errorName: err instanceof Error ? err.name : "unknown",
    });

    const isDev = process.env.NODE_ENV !== "production";

    if (err instanceof InputTooShortError) {
      return NextResponse.json(
        { error: err.message, code: "input_too_short" },
        { status: 400 }
      );
    }
    if (err instanceof NoAIKeyConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "AI provider rate limit; try again shortly" },
        { status: 503 }
      );
    }
    if (err instanceof InvalidResponseError) {
      return NextResponse.json(
        {
          error: "AI returned an invalid response; please try again",
          ...(isDev && { detail: errorMessage }),
        },
        { status: 502 }
      );
    }
    if (err instanceof AIAPIError) {
      return NextResponse.json(
        {
          error: "AI provider error",
          ...(isDev && { detail: errorMessage }),
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate Story Bible" },
      { status: 500 }
    );
  }
}
