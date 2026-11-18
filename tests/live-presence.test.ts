import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/presence/route";
import { callRoute, installTestDatabase } from "./support/d1";

const send = (tabId: string, browserId: string, revision: number, active: boolean) =>
  POST(
    new Request("http://test/api/presence", {
      method: "POST",
      body: JSON.stringify({ tabId, browserId, revision, active }),
    }),
  );

it("counts visible browsers once, ignores delayed heartbeats and expires vanished tabs", async () => {
  installTestDatabase();
  vi.useFakeTimers();
  try {
    const a = crypto.randomUUID(),
      b = crypto.randomUUID(),
      c = crypto.randomUUID();
    const first = crypto.randomUUID(),
      second = crypto.randomUUID();
    expect(await (await send(a, first, 1, true)).json()).toEqual({ count: 1 });
    expect(await (await send(b, first, 1, true)).json()).toEqual({ count: 1 });
    expect((await send(a, first, 3, false)).status).toBe(204);
    await send(a, first, 2, true);
    expect(await (await send(c, second, 1, true)).json()).toEqual({ count: 2 });
    await send(b, first, 2, false);
    expect(await (await send(c, second, 2, true)).json()).toEqual({ count: 1 });
    vi.advanceTimersByTime(26_000);
    expect(await (await send(a, first, 4, true)).json()).toEqual({ count: 1 });
    expect((await callRoute(POST, { active: true })).status).toBe(400);
  } finally {
    vi.useRealTimers();
  }
});
