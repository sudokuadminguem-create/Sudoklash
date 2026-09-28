// Stand-in for app/supabase-auth.ts: tests choose who is signed in.
type SiteUser = { userId: string; displayName: string; email: string; fullName: string | null };

let current: SiteUser | null = null;

export function signIn(userId: string | null) {
  current = userId
    ? { userId, displayName: userId, email: `${userId}@test`, fullName: null }
    : null;
}

export async function getSiteUser(): Promise<SiteUser | null> {
  return current;
}
