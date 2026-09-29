// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDuelInvites } from "@/app/lib/use-duel-invites";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, container: HTMLDivElement;
let incoming: { id: string; from: { username: string } }[];
let visibility: DocumentVisibilityState;

function Probe({ userId, onInvite }: { userId?: string; onInvite: (from: string) => void }) {
  return <output>{useDuelInvites(userId, onInvite, 1000)}</output>;
}
const count = () => container.querySelector("output")!.textContent;
const tick = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
  incoming = [];
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ incoming }), { status: 200 })),
  );
});
afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useDuelInvites", () => {
  it("does nothing for a signed-out visitor", async () => {
    await act(async () => root.render(<Probe onInvite={vi.fn()} />));
    await tick(5000);
    expect(fetch).not.toHaveBeenCalled();
    expect(count()).toBe("0");
  });

  it("counts pending challenges and announces each new one once", async () => {
    const onInvite = vi.fn();
    await act(async () => root.render(<Probe userId="alice" onInvite={onInvite} />));
    await tick(10);
    expect(count()).toBe("0");
    expect(onInvite).not.toHaveBeenCalled();

    incoming = [{ id: "a", from: { username: "Bob" } }];
    await tick(1000);
    expect(count()).toBe("1");
    expect(onInvite).toHaveBeenCalledWith("Bob");
    await tick(3000); // still there: not announced again
    expect(onInvite).toHaveBeenCalledTimes(1);

    incoming = [...incoming, { id: "b", from: { username: "Carol" } }];
    await tick(1000);
    expect(count()).toBe("2");
    expect(onInvite).toHaveBeenLastCalledWith("Carol");
    expect(onInvite).toHaveBeenCalledTimes(2);

    incoming = [];
    await tick(1000);
    expect(count()).toBe("0");
  });

  it("does not poll while the tab is hidden", async () => {
    await act(async () => root.render(<Probe userId="alice" onInvite={vi.fn()} />));
    await tick(10);
    const before = vi.mocked(fetch).mock.calls.length;
    visibility = "hidden";
    await tick(5000);
    expect(vi.mocked(fetch).mock.calls.length).toBe(before);
    visibility = "visible";
    await tick(1000);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(before);
  });

  it("survives a failed request and stops when unmounted", async () => {
    const onInvite = vi.fn();
    await act(async () => root.render(<Probe userId="alice" onInvite={onInvite} />));
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await tick(1000);
    incoming = [{ id: "a", from: { username: "Bob" } }];
    await tick(1000);
    expect(onInvite).toHaveBeenCalledWith("Bob");
    await act(async () => root.unmount());
    const calls = vi.mocked(fetch).mock.calls.length;
    await tick(5000);
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
    root = createRoot(container); // for afterEach
  });
});
