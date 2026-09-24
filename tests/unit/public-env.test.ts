import { describe, it, expect, afterEach, vi } from "vitest";
import {
  PUBLIC_ENV_GLOBAL,
  publicEnv,
  runtimeEnv,
  serverPublicEnv,
} from "@/lib/public-env";

// The point of lib/public-env.ts is that a built image carries no deployment
// configuration: everything below must reflect the environment as it is *now*,
// not as it was when the bundle was compiled.
describe("public env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window[PUBLIC_ENV_GLOBAL];
  });

  it("reads the current value of a variable, not a build-time snapshot", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_first");
    expect(serverPublicEnv().posthogKey).toBe("phc_first");

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_second");
    expect(serverPublicEnv().posthogKey).toBe("phc_second");
  });

  it("falls back to empty strings rather than throwing when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(serverPublicEnv().posthogKey).toBe("");
  });

  it("defaults the PostHog host when it is unset or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    expect(serverPublicEnv().posthogHost).toBe("https://us.i.posthog.com");
  });

  it("prefers the injected global in the browser", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_from_build");
    window[PUBLIC_ENV_GLOBAL] = {
      posthogKey: "phc_injected",
      posthogHost: "https://eu.i.posthog.com",
    };

    expect(publicEnv().posthogKey).toBe("phc_injected");
    expect(publicEnv().posthogHost).toBe("https://eu.i.posthog.com");
  });

  it("falls back to process.env when nothing has been injected", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_from_process");
    expect(publicEnv().posthogKey).toBe("phc_from_process");
  });

  it("returns undefined for a variable that is not set", () => {
    expect(runtimeEnv("MANUHAVEN_DEFINITELY_UNSET")).toBeUndefined();
  });
});
