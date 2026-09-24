// The AI cooldowns and burst throttle under concurrent requests: the checks
// used to run before the stamp, so N parallel requests all passed.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createProject } from "@/lib/db/queries/projects";
import {
  claimAiCooldown,
  getManuscript,
  releaseAiCooldown,
  saveManuscriptContent,
} from "@/lib/db/queries/manuscripts";
import { AI_THROTTLE_MAX_CALLS, enforceAiThrottle } from "@/lib/ai/throttle";
import { closeDb, createTestUser, removeTestUsers } from "./helpers";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let carol: string;
let carolProject: string;

beforeAll(async () => {
  carol = await createTestUser("carol");
  ({ id: carolProject } = await createProject(carol, {
    title: "Carol's Book",
    genre: "mystery",
  }));
  await saveManuscriptContent(carol, carolProject, {
    tiptapJson: { type: "doc", content: [] },
    wordCount: 0,
    chapters: [],
  });
});

afterAll(async () => {
  await removeTestUsers(carol);
  await closeDb();
});

describe("claimAiCooldown", () => {
  it("lets exactly one of many parallel claims through", async () => {
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        claimAiCooldown(carol, carolProject, "lastAiEditorialAt", WEEK_MS),
      ),
    );
    expect(claims.filter((c) => c?.ok)).toHaveLength(1);
    for (const c of claims) {
      if (c && !c.ok) expect(c.retryAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("restores the previous stamp on release", async () => {
    const claim = await claimAiCooldown(
      carol,
      carolProject,
      "lastAiContinuityAt",
      WEEK_MS,
    );
    expect(claim).toMatchObject({ ok: true, previous: null });
    if (!claim?.ok) return;

    await releaseAiCooldown(carol, carolProject, "lastAiContinuityAt", claim);
    expect(
      (await getManuscript(carol, carolProject))?.lastAiContinuityAt,
    ).toBeNull();
    const again = await claimAiCooldown(
      carol,
      carolProject,
      "lastAiContinuityAt",
      WEEK_MS,
    );
    expect(again?.ok).toBe(true);
  });

  it("leaves a newer stamp alone on release", async () => {
    const first = await claimAiCooldown(
      carol,
      carolProject,
      "lastAiMetadataAt",
      0,
    );
    const second = await claimAiCooldown(
      carol,
      carolProject,
      "lastAiMetadataAt",
      0,
    );
    if (!first?.ok || !second?.ok) throw new Error("claims should pass");

    await releaseAiCooldown(carol, carolProject, "lastAiMetadataAt", first);
    expect(
      (await getManuscript(carol, carolProject))?.lastAiMetadataAt,
    ).toEqual(second.stampedAt);
  });
});

describe("enforceAiThrottle", () => {
  it("never lets a parallel burst past the cap", async () => {
    vi.stubEnv("AI_RATELIMIT_DISABLED", "");
    const results = await Promise.all(
      Array.from({ length: AI_THROTTLE_MAX_CALLS + 5 }, () =>
        enforceAiThrottle(carol, carolProject, "editorial"),
      ),
    );
    vi.unstubAllEnvs();
    const allowed = results.filter((id) => id !== null);
    expect(allowed.length).toBeLessThanOrEqual(AI_THROTTLE_MAX_CALLS);
    expect(await enforceAiThrottle(carol, null, "settings_test")).toBeNull();
  });
});
