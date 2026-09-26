import { bearerToken, verifySupabaseToken } from "@/lib/supabase-config";
import { getChatGPTUser } from "./chatgpt-auth";

/** Player behind an API request: a Supabase account first, then the hosting platform identity. */
export async function getSiteUser(request?: Request) {
  const user = await verifySupabaseToken(bearerToken(request));
  if (user)
    return {
      userId: user.id,
      displayName: user.user_metadata?.full_name ?? user.email ?? "Joueur",
      email: user.email ?? "",
      fullName: user.user_metadata?.full_name ?? null,
    };
  return getChatGPTUser();
}
