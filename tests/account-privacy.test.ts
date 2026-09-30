import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "./support/workers";
import { installTestDatabase } from "./support/d1";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase-config", () => ({
  bearerToken: () => "token",
  supabaseUrl: "https://test.supabase.co",
  verifySupabaseToken: mocks.verify,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { deleteUser: mocks.remove } } }),
}));
import { GET, DELETE } from "@/app/api/account/privacy/route";
let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  mocks.verify.mockResolvedValue({
    id: "alice",
    email: "alice@test",
    created_at: "2026-01-01",
    identities: [{ provider: "email" }],
  });
  mocks.remove.mockReset();
  mocks.remove.mockResolvedValue({ error: null });
  delete (env as unknown as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const id of ["alice", "bob"])
    db.prepare(
      "INSERT INTO player_profiles(user_id,username,username_key,created_at) VALUES (?,?,?,1)",
    ).run(id, id, id);
});
const request = (confirmation = "SUPPRIMER") =>
  new Request("http://test/privacy", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
describe("account privacy", () => {
  it("requires the account identity and does not expose credentials", async () => {
    const response = await GET(new Request("http://test/privacy"));
    expect(await response.json()).toMatchObject({
      email: "alice@test",
      providers: ["email"],
      deletionAvailable: false,
    });
    mocks.verify.mockResolvedValue(null);
    expect((await GET(new Request("http://test/privacy"))).status).toBe(401);
  });
  it("leaves records untouched without confirmation or administrator access", async () => {
    expect((await DELETE(request("wrong"))).status).toBe(400);
    expect((await DELETE(request())).status).toBe(503);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(db.prepare("SELECT COUNT(*) AS n FROM player_profiles").get()).toEqual({ n: 2 });
  });
  it("deletes only the verified account and keeps another player's profile", async () => {
    (env as unknown as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY = "test-secret";
    expect((await DELETE(request())).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith("alice");
    expect(db.prepare("SELECT user_id FROM player_profiles").all()).toEqual([{ user_id: "bob" }]);
  });
  it("keeps game data when the identity service refuses deletion", async () => {
    (env as unknown as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY = "test-secret";
    mocks.remove.mockResolvedValue({ error: { message: "failed" } });
    expect((await DELETE(request())).status).toBe(502);
    expect(db.prepare("SELECT COUNT(*) AS n FROM player_profiles").get()).toEqual({ n: 2 });
  });
});
