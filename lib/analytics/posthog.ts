import posthog from "posthog-js";
import { publicEnv } from "@/lib/public-env";

let initialized = false;

function getKey(): string | undefined {
  return publicEnv().posthogKey || undefined;
}

export function initPosthog(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = getKey();
  if (!key) return;

  posthog.init(key, {
    api_host: publicEnv().posthogHost,
    capture_pageview: false,
    person_profiles: "identified_only",
    // Autocapture and session recording would record whatever is on screen,
    // manuscript text included (Golden Rule 9). Only named events are sent.
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!getKey()) return;
  if (!initialized) initPosthog();
  if (!initialized) return;
  posthog.capture(event, properties);
}

export { posthog };
