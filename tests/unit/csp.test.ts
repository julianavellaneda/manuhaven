import { describe, it, expect } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `));
}

describe("buildCsp", () => {
  const base = { nonce: "abc123", isDev: false, analyticsHost: "" };

  it("allows scripts only through the nonce and strict-dynamic in production", () => {
    const csp = buildCsp(base);
    expect(directive(csp, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds unsafe-eval in development only", () => {
    expect(directive(buildCsp({ ...base, isDev: true }), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("keeps same-origin framing for the PDF preview and blocks plugins", () => {
    const csp = buildCsp(base);
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
  });

  it("connects to self only when analytics is off", () => {
    expect(directive(buildCsp(base), "connect-src")).toBe("connect-src 'self'");
  });

  it("adds a PostHog cloud host and its assets host", () => {
    const csp = buildCsp({ ...base, analyticsHost: "https://eu.i.posthog.com" });
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com",
    );
  });

  it("adds a self-hosted PostHog origin without a path", () => {
    const csp = buildCsp({ ...base, analyticsHost: "https://ph.example.com/ingest" });
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://ph.example.com");
  });

  it("ignores a malformed or non-http analytics host", () => {
    for (const analyticsHost of ["not a url", "javascript:alert(1)", "*"]) {
      expect(directive(buildCsp({ ...base, analyticsHost }), "connect-src")).toBe(
        "connect-src 'self'",
      );
    }
  });
});

describe("createNonce", () => {
  it("is unique per call and safe inside a CSP source expression", () => {
    const a = createNonce();
    expect(a).not.toBe(createNonce());
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
