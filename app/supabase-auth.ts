import { createClient } from "@supabase/supabase-js";
import { getChatGPTUser } from "./chatgpt-auth";

export async function getSiteUser(request?: Request) {
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (bearer && url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(bearer);
    if (!error && data.user)
      return {
        userId: data.user.id,
        displayName: data.user.user_metadata?.full_name ?? data.user.email ?? "Joueur",
        email: data.user.email ?? "",
        fullName: data.user.user_metadata?.full_name ?? null,
      };
  }
  return getChatGPTUser();
}
