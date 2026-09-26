import { supabase } from "./supabase";

/** Authorization header for the API routes, empty when nobody is signed in. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
