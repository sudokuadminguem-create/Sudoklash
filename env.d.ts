// Bindings the hosting platform injects into the Worker (see .openai/hosting.json).
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}

declare module "*.css";
