/**
 * The Content-Security-Policy for every rendered page, built per request by
 * `proxy.ts` around a fresh nonce. Next.js reads the nonce back out of the
 * request's CSP header and stamps it on its own scripts; anything a nonced
 * script loads is trusted through `'strict-dynamic'`.
 *
 * Styles keep `'unsafe-inline'`: React `style` attributes (Tiptap, Recharts,
 * Base UI positioning) can't carry a nonce, and style injection is not a
 * script-execution path. There is no `upgrade-insecure-requests`, because
 * self-hosters on plain http (localhost, a LAN box) would have every asset
 * request rewritten to an https port that isn't listening.
 */
export function buildCsp({
  nonce,
  isDev,
  analyticsHost,
}: {
  nonce: string;
  isDev: boolean;
  /** PostHog API host, or "" when analytics is off. */
  analyticsHost: string;
}): string {
  const connect = ["'self'", ...analyticsOrigins(analyticsHost)];
  const directives = [
    "default-src 'self'",
    // React uses eval in development to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: for the local cover preview before upload.
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];
  return directives.join("; ");
}

/**
 * PostHog's API host plus, for its cloud regions, the matching assets host
 * (`us.i.posthog.com` → `us-assets.i.posthog.com`), which serves the config
 * the SDK fetches on start. A malformed host adds nothing rather than widening
 * the policy.
 */
function analyticsOrigins(host: string): string[] {
  if (!host) return [];
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];
  const origins = [url.origin];
  const region = /^([a-z]+)\.i\.posthog\.com$/.exec(url.hostname);
  if (region) origins.push(`https://${region[1]}-assets.i.posthog.com`);
  return origins;
}

/** A per-request nonce: a random UUID, base64-encoded as Next's docs do. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}
