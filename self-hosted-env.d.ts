// Set only by the self-hosted (Docker) runtime, see lib/runtime/node-workers.ts.
declare namespace Cloudflare {
  interface Env {
    /** "untrusted" when self-hosted: no proxy guarantees the `oai-authenticated-*` headers. */
    PLATFORM_AUTH_HEADERS?: "untrusted";
  }
}
