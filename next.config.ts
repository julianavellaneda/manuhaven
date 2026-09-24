import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Baseline hardening for every response. Framing is 'self', not 'none': the
// export preview shows PDFs from /api/files in a same-origin iframe. HSTS has
// no includeSubDomains, since a self-hoster's other subdomains aren't ours to
// pin, and browsers ignore it over plain http (localhost, LAN installs).
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules it actually traced. The root Dockerfile depends on this.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
