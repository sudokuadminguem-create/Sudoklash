// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authCookieStorage } from "@/app/lib/auth-cookie-storage";

const KEY = "sb-test-auth-token";

function clearAllCookies() {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

describe("authCookieStorage with local storage blocked", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearAllCookies();
  });

  it("splits a long session over several cookies and reads it back", () => {
    const value = "é".repeat(2000); // 12 000 characters once encoded: 5 cookies.
    authCookieStorage.setItem(KEY, value);
    expect(document.cookie).toContain("count=5");
    expect(authCookieStorage.getItem(KEY)).toBe(value);
  });

  it("stores an empty session as no cookie at all", () => {
    authCookieStorage.setItem(KEY, "");
    expect(document.cookie).toContain("count=0");
    expect(authCookieStorage.getItem(KEY)).toBeNull();
  });

  it("refuses a session too large for 20 cookies", () => {
    expect(() => authCookieStorage.setItem(KEY, "x".repeat(2600 * 20 + 1))).toThrow(
      "Session trop volumineuse",
    );
  });

  it("ignores a session with a missing piece", () => {
    authCookieStorage.setItem(KEY, "y".repeat(6000));
    const missing = document.cookie
      .split("; ")
      .map((part) => part.split("=")[0])
      .find((name) => name.endsWith("_1"));
    document.cookie = `${missing}=; Path=/; Max-Age=0`;
    expect(authCookieStorage.getItem(KEY)).toBeNull();
  });
});
