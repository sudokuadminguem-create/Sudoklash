import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./support/workers";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "oai-authenticated-user-id": "forged",
      "oai-authenticated-user-email": "admin@example.com",
    }),
}));
const { getChatGPTUser } = await import("@/app/chatgpt-auth");

afterEach(() => delete (env as Cloudflare.Env).PLATFORM_AUTH_HEADERS);

describe("platform identity headers", () => {
  it("are trusted on the hosting platform", async () => {
    expect(await getChatGPTUser()).toMatchObject({ userId: "forged" });
  });

  it("are ignored when self-hosted, where anyone could send them", async () => {
    (env as Cloudflare.Env).PLATFORM_AUTH_HEADERS = "untrusted";
    expect(await getChatGPTUser()).toBeNull();
  });
});
