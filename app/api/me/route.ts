import { getAdminUser } from "@/app/admin/auth";
import { getSiteUser } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const admin = await getAdminUser(request);
  const user = admin ?? await getSiteUser(request);
  return Response.json({ signedIn: Boolean(user), isAdmin: Boolean(admin), displayName: user?.displayName ?? null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
