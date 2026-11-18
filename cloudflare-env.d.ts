declare namespace Cloudflare {
  interface Env {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    PAYMENT_SITE_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
