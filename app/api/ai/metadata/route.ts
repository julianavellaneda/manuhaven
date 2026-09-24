import { NextResponse } from "next/server";
import { z } from "zod";
import { GENRES, type Genre } from "@/lib/constants";
import { generateBookMetadata } from "@/lib/ai/metadata";
import { preflightAI } from "@/lib/ai/preflight";
import {
  AIAPIError,
  InvalidResponseError,
  RateLimitError,
  NoAIKeyConfiguredError,
} from "@/lib/ai/errors";
import { AI_THROTTLED_BODY, enforceAiThrottle } from "@/lib/ai/throttle";
import { getSessionUser } from "@/lib/auth/session";
import {
  getOwnedProject,
  saveProjectAiMetadata,
} from "@/lib/db/queries/projects";
import {
  claimAiCooldown,
  getManuscript,
  releaseAiCooldown,
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

  const usageEventId = await enforceAiThrottle(user.id, projectId, "metadata");
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
      "lastAiMetadataAt",
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
        "lastAiMetadataAt",
        cooldown
      ).catch(() => undefined);
    }
  };

  const genre: Genre = (GENRES as readonly string[]).includes(project.genre ?? "")
    ? (project.genre as Genre)
    : "other";

  const started = Date.now();
  try {
    const result = await generateBookMetadata({
      userId: user.id,
      tiptapJson: manuscript.tiptapJson,
      genre,
    });

    // Saves the metadata and stamps the cooldown in one transaction. A driver
    // error can quote the row, i.e. manuscript text: never log it.
    const saved = await saveProjectAiMetadata(user.id, projectId, result).catch(
      () => false
    );
    if (!saved) {
      console.error("[ai/metadata] failed to save ai_metadata", { projectId });
      return NextResponse.json(
        { error: "Failed to persist generated metadata; please try again" },
        { status: 500 }
      );
    }

    console.log("[ai/metadata] generated", {
      projectId,
      genre,
      latencyMs: Date.now() - started,
    });

    return NextResponse.json({ metadata: result });
  } catch (err) {
    await releaseCooldown();
    // Only for the dev-mode response detail: never log it, it can quote
    // model output derived from the manuscript.
    const errorMessage = err instanceof Error ? err.message : "unknown";
    console.error("[ai/metadata] failed", {
      projectId,
      genre,
      latencyMs: Date.now() - started,
      errorName: err instanceof Error ? err.name : "unknown",
    });

    const isDev = process.env.NODE_ENV !== "production";

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
      { error: "Failed to generate metadata" },
      { status: 500 }
    );
  }
}
