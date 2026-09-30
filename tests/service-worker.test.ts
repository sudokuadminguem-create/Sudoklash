import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// public/sw.js is a plain script: run it against a small fake of the worker environment.
type Listener = (event: unknown) => void;

function boot(online: () => boolean) {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, unknown>>();
  const key = (input: unknown) => (typeof input === "string" ? input : (input as Request).url);
  const respond = (body: string, ok = true) => ({ body, ok, clone: () => respond(body, ok) });
  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map();
      stores.set(name, store);
      return {
        add: async (url: string) => {
          if (!online()) throw new Error("offline");
          store.set(new URL(url, "https://app.test").href, respond(`fresh:${url}`));
        },
        put: async (input: unknown, value: unknown) =>
          void store.set(new URL(key(input), "https://app.test").href, value),
        match: async (input: unknown) => store.get(new URL(key(input), "https://app.test").href),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const context = {
    self: {
      location: new URL("https://app.test/"),
      addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches,
    URL,
    Promise,
    fetch: async (request: Request | string) => {
      if (!online()) throw new Error("offline");
      return respond(`net:${key(request)}`);
    },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), context);
  const request = (path: string, init: { method?: string; mode?: string } = {}) => ({
    url: `https://app.test${path}`,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
  });
  /** Dispatches a fetch event; null when the worker leaves the request to the browser. */
  const fetchEvent = async (req: ReturnType<typeof request>) => {
    let promise = null as Promise<{ body: string }> | null;
    listeners.fetch({ request: req, respondWith: (p: Promise<{ body: string }>) => (promise = p) });
    return promise ? await promise : null;
  };
  const lifecycle = async (type: "install" | "activate") => {
    let promise: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (p: Promise<unknown>) => (promise = p) });
    await promise;
  };
  return { stores, request, fetchEvent, lifecycle };
}

let connected = true;
beforeEach(() => (connected = true));

describe("service worker", () => {
  it("precaches the shell, and installs even when a file is missing", async () => {
    const worker = boot(() => connected);
    await worker.lifecycle("install");
    expect([...worker.stores.get("sudoklash-shell-v2")!.keys()]).toContain("https://app.test/");
    connected = false;
    await expect(boot(() => connected).lifecycle("install")).resolves.toBeUndefined();
  });

  it("serves the last known page when a navigation happens offline", async () => {
    const worker = boot(() => connected);
    const page = worker.request("/", { mode: "navigate" });
    expect((await worker.fetchEvent(page))!.body).toBe("net:https://app.test/");
    connected = false;
    expect((await worker.fetchEvent(worker.request("/profil", { mode: "navigate" })))!.body).toBe(
      "net:https://app.test/",
    );
  });

  it("keeps fingerprinted files for good and refreshes other static files", async () => {
    const worker = boot(() => connected);
    const asset = worker.request("/assets/index-abc123.js");
    await worker.fetchEvent(asset);
    connected = false;
    expect((await worker.fetchEvent(asset))!.body).toBe(
      "net:https://app.test/assets/index-abc123.js",
    );
    connected = true;
    const icon = worker.request("/icons/icon-192.png");
    await worker.fetchEvent(icon);
    connected = false;
    expect((await worker.fetchEvent(icon))!.body).toContain("icon-192.png");
  });

  it("never touches the API, other origins, writes or itself", async () => {
    const worker = boot(() => connected);
    expect(await worker.fetchEvent(worker.request("/api/solo"))).toBeNull();
    expect(
      await worker.fetchEvent(worker.request("/", { method: "POST", mode: "navigate" })),
    ).toBeNull();
    expect(await worker.fetchEvent(worker.request("/sw.js"))).toBeNull();
    expect(
      await worker.fetchEvent({ ...worker.request("/x.js"), url: "https://cdn.test/x.js" }),
    ).toBeNull();
    expect(await worker.fetchEvent(worker.request("/some/data"))).toBeNull();
  });

  it("removes caches of older versions when it takes over", async () => {
    const worker = boot(() => connected);
    worker.stores.set("sudoklash-shell-v0", new Map());
    worker.stores.set("other-app", new Map());
    await worker.lifecycle("activate");
    expect(worker.stores.has("sudoklash-shell-v0")).toBe(false);
    expect(worker.stores.has("other-app")).toBe(true);
  });
});
