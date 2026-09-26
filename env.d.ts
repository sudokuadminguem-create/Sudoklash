// Bindings the hosting platform injects into the Worker (see .openai/hosting.json).
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** "untrusted" when self-hosted: no proxy guarantees the `oai-authenticated-*` headers. */
    PLATFORM_AUTH_HEADERS?: "untrusted";
  }
}

declare module "*.css";
