/**
 * Browser-visible configuration, resolved at runtime rather than baked in.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` into the client bundle at build
 * time, which would make a published Docker image usable only by whoever built
 * it. Instead the server renders these values into the document (see
 * `PublicEnvScript`) and client code reads them from there, so one image runs
 * against any deployment.
 *
 * Only values that are public by design belong here, such as the PostHog
 * project key. Never add a secret or a provider API key.
 */
export type PublicEnv = {
  posthogKey: string;
  posthogHost: string;
};

export const PUBLIC_ENV_GLOBAL = "__MANUHAVEN_PUBLIC_ENV__";

declare global {
  interface Window {
    [PUBLIC_ENV_GLOBAL]?: PublicEnv;
  }
}

/**
 * Look a variable up dynamically. Writing `process.env.NEXT_PUBLIC_FOO` would
 * be substituted with its build-time value by the compiler — on the server as
 * well as in the browser — which is exactly what this module exists to avoid.
 * Going through an indexed access on an aliased object keeps it a real lookup.
 */
export function runtimeEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}


/** Read the environment on the server, where `process.env` is live. */
export function serverPublicEnv(): PublicEnv {
  return {
    posthogKey: runtimeEnv("NEXT_PUBLIC_POSTHOG_KEY") ?? "",
    posthogHost:
      runtimeEnv("NEXT_PUBLIC_POSTHOG_HOST") || "https://us.i.posthog.com",
  };
}

/**
 * Read the environment from wherever it is available: the injected global in
 * the browser, `process.env` on the server (including while server-rendering a
 * client component, which happens before the script has run).
 */
export function publicEnv(): PublicEnv {
  if (typeof window !== "undefined") {
    const injected = window[PUBLIC_ENV_GLOBAL];
    if (injected) return injected;
  }
  return serverPublicEnv();
}
