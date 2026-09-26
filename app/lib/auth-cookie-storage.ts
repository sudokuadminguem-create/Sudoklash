// Supabase stores the session and, for recovery links, a separate code verifier.
// Keep each storage key in its own cookie set so one cannot overwrite the other.
const prefix = "sudoku_clash_session_";
const lifetime = 60 * 60 * 24 * 30;
const chunkSize = 2600;

function cookieOptions(maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function scope(key: string) {
  return `${prefix}${encodeURIComponent(key).replace(/%/g, "_")}_`;
}

function readCookie(name: string) {
  const part = document.cookie.split("; ").find(value => value.startsWith(`${name}=`));
  return part ? part.slice(name.length + 1) : null;
}

function clearCookies(names: string[]) {
  for (const name of names) document.cookie = `${name}=${cookieOptions(0)}`;
}

function scopedCookies(cookiePrefix: string) {
  return document.cookie.split("; ").map(part => part.split("=")[0]).filter(name => name.startsWith(cookiePrefix));
}

function readChunks(cookiePrefix: string): string | null {
  const count = Number(readCookie(`${cookiePrefix}count`));
  if (!Number.isInteger(count) || count < 1 || count > 20) return null;
  const pieces = Array.from({ length: count }, (_, index) => readCookie(`${cookiePrefix}${index}`));
  if (pieces.some(piece => piece === null)) return null;
  try { return decodeURIComponent(pieces.join("")); }
  catch { clearCookies(scopedCookies(cookiePrefix)); return null; }
}

function legacyCookies() {
  return document.cookie.split("; ").map(part => part.split("=")[0]).filter(name =>
    name === `${prefix}count` || new RegExp(`^${prefix}[0-9]+$`).test(name),
  );
}

export const authCookieStorage = {
  getItem(key: string): string | null {
    if (typeof document === "undefined") return null;
    const current = readChunks(scope(key));
    if (current) return current;

    // Migrate sessions from older versions, without copying them into code verifiers.
    if (key.endsWith("-auth-token")) {
      const old = readChunks(prefix);
      if (old) { this.setItem(key, old); clearCookies(legacyCookies()); return old; }
    }
    const previous = window.localStorage.getItem(key);
    if (previous) { this.setItem(key, previous); window.localStorage.removeItem(key); }
    return previous;
  },
  setItem(key: string, value: string): void {
    if (typeof document === "undefined") return;
    const cookiePrefix = scope(key);
    clearCookies(scopedCookies(cookiePrefix));
    const encoded = encodeURIComponent(value);
    const pieces = encoded.match(new RegExp(`.{1,${chunkSize}}`, "g")) ?? [];
    if (pieces.length > 20) throw new Error("Session trop volumineuse");
    pieces.forEach((piece, index) => { document.cookie = `${cookiePrefix}${index}=${piece}${cookieOptions(lifetime)}`; });
    document.cookie = `${cookiePrefix}count=${pieces.length}${cookieOptions(lifetime)}`;
  },
  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    clearCookies(scopedCookies(scope(key)));
    if (key.endsWith("-auth-token")) clearCookies(legacyCookies());
    window.localStorage.removeItem(key);
  },
};
