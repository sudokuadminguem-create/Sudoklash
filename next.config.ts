import type { NextConfig } from "next";

// The hosting platform builds this app with vinext, which also reads this file. Everything
// here is for the self-hosted (Docker) build only, enabled by SUDOKLASH_SELF_HOSTED=1: the
// platform must keep the real "cloudflare:workers" module (D1), its identity headers and its
// own response headers.
const selfHosted = process.env.SUDOKLASH_SELF_HOSTED === "1";

const supabaseOrigin = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxppazlcvjfwumtbkibn.supabase.co",
).origin;

// Next.js injects inline bootstrap scripts, hence 'unsafe-inline' for scripts; everything
// else is limited to this site and Supabase (auth API and realtime websocket).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const selfHostedConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    resolveAlias: { "cloudflare:workers": "./lib/runtime/node-workers.ts" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default selfHosted ? selfHostedConfig : {};
