import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "sudokuadminguem@gmail.com";

export async function getAdminUser(request: Request): Promise<{ displayName: string } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  const user = data.user;
  if (error || !user || !user.email_confirmed_at || user.email?.toLowerCase() !== OWNER_EMAIL)
    return null;
  return { displayName: user.user_metadata?.full_name ?? user.email ?? "Administrateur" };
}
