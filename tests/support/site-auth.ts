// Stand-in for app/supabase-auth.ts: tests choose who is signed in.
type SiteUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  signupInvite?: string;
  accountCreatedAt?: number;
};

let current: SiteUser | null = null;

export function signIn(
  userId: string | null,
  signup?: Pick<SiteUser, "signupInvite" | "accountCreatedAt">,
) {
  current = userId
    ? { userId, displayName: userId, email: `${userId}@test`, fullName: null, ...signup }
    : null;
}

export async function getSiteUser(): Promise<SiteUser | null> {
  return current;
}
