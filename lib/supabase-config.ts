import { createClient, type User } from "@supabase/supabase-js";

// Public project settings (safe to ship to browsers). The environment can override them;
// browser and Worker share these values so the server can always verify sign-ins.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxppazlcvjfwumtbkibn.supabase.co";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_2MtK14MvID1XTFJTD-rwKw_qP9Af17Y";

/** Reads the bearer token of an API request. */
export function bearerToken(request?: Request) {
  return request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

/** The Supabase user behind an access token, or null when it is missing or invalid. */
export async function verifySupabaseToken(token: string | null): Promise<User | null> {
  if (!token) return null;
  const client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
