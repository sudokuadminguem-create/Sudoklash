import { bearerToken, verifySupabaseToken } from "@/lib/supabase-config";

const OWNER_EMAIL = "sudokuadminguem@gmail.com";

export async function getAdminUser(request: Request): Promise<{ displayName: string } | null> {
  const user = await verifySupabaseToken(bearerToken(request));
  if (!user || !user.email_confirmed_at || user.email?.toLowerCase() !== OWNER_EMAIL) return null;
  return { displayName: user.user_metadata?.full_name ?? user.email ?? "Administrateur" };
}
