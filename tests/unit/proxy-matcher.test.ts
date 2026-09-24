import { describe, it, expect, vi } from "vitest";

// proxy.ts runs `createMiddleware(routing)` at import time. That doesn't matter
// for asserting the static `config.matcher`, so we stub it and just exercise
// the exported matcher regex.
vi.mock("next-intl/middleware", () => ({
  default: () => () => undefined,
}));

import { config } from "@/proxy";

// Next.js compiles each matcher string into an anchored path regex. The string
// is already a valid JS regex (negative-lookahead + `.*`), so anchoring it with
// ^…$ reproduces the include/exclude decision the framework makes per request.
function matches(pathname: string): boolean {
  const pattern = config.matcher[0]!;
  return new RegExp(`^${pattern}$`).test(pathname);
}

describe("proxy middleware matcher", () => {
  it("excludes /sitemap.xml so the root app/sitemap.ts is not run through i18n routing", () => {
    // Regression: before the fix the matcher only excluded image/static
    // extensions, so /sitemap.xml fell through to next-intl middleware which
    // could rewrite/redirect away from the real sitemap route.
    expect(matches("/sitemap.xml")).toBe(false);
  });

  it("excludes /robots.txt for the same reason", () => {
    expect(matches("/robots.txt")).toBe(false);
  });

  it("still excludes API routes, including Better Auth's", () => {
    expect(matches("/api/health")).toBe(false);
    expect(matches("/api/auth/callback/google")).toBe(false);
  });

  it("still excludes static asset files", () => {
    expect(matches("/logo.svg")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  it("still runs on real localized pages (does not over-exclude)", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/es")).toBe(true);
    expect(matches("/welcome")).toBe(true);
    expect(matches("/es/welcome")).toBe(true);
    expect(matches("/dashboard")).toBe(true);
  });
});
