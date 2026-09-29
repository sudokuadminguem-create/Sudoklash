// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  applyDisplay,
  defaultSettings,
  displayScript,
  fontScales,
  parseSettings,
  preferredSettings,
  STORAGE_KEY,
} from "@/app/lib/settings-model";

describe("parseSettings", () => {
  it("keeps known settings of the right kind", () => {
    expect(
      parseSettings({ highContrast: true, colorblind: true, fontScale: "large", showTimer: false }),
    ).toEqual({ highContrast: true, colorblind: true, fontScale: "large", showTimer: false });
  });

  it("drops unknown keys, wrong types and unknown text sizes", () => {
    expect(
      parseSettings({
        highContrast: "yes",
        colorblind: 1,
        fontScale: "huge",
        showTimer: null,
        admin: true,
        __proto__: { highContrast: true },
      }),
    ).toEqual({});
    expect(parseSettings({ fontScale: true })).toEqual({});
  });

  it("copes with anything else that is stored", () => {
    for (const bad of [null, undefined, "text", 3, true]) expect(parseSettings(bad)).toEqual({});
    expect(parseSettings([true, false])).toEqual({});
  });

  it("offers three text sizes, the first being the default", () => {
    expect(fontScales).toEqual(["normal", "large", "xlarge"]);
    expect(defaultSettings.fontScale).toBe("normal");
    expect(defaultSettings.highContrast).toBe(false);
    expect(defaultSettings.colorblind).toBe(false);
  });
});

describe("what the system asks for", () => {
  it("turns high contrast on for a visitor who prefers more contrast", () => {
    expect(preferredSettings(true)).toEqual({ highContrast: true });
    expect(preferredSettings(false)).toEqual({});
  });
});

describe("applyDisplay", () => {
  it("puts the three display settings on the page", () => {
    const root = document.createElement("html");
    applyDisplay({ highContrast: true, colorblind: true, fontScale: "xlarge" }, root);
    expect(root.dataset).toMatchObject({ contrast: "high", colorblind: "on", fontScale: "xlarge" });
    applyDisplay(defaultSettings, root);
    expect(root.dataset).toMatchObject({
      contrast: "normal",
      colorblind: "off",
      fontScale: "normal",
    });
  });
});

describe("the script that runs before the first paint", () => {
  /** Runs the script against a fake page, storage and system preference. */
  function run(stored: string | null, prefersMoreContrast = false) {
    const root = document.createElement("html");
    const storage = { getItem: (key: string) => (key === STORAGE_KEY ? stored : null) };
    const matchMedia = () => ({ matches: prefersMoreContrast });
    new Function("document", "localStorage", "matchMedia", displayScript)(
      { documentElement: root },
      storage,
      matchMedia,
    );
    return root.dataset;
  }

  it("applies the saved display settings", () => {
    expect(
      run(JSON.stringify({ highContrast: true, colorblind: true, fontScale: "large" })),
    ).toMatchObject({ contrast: "high", colorblind: "on", fontScale: "large" });
  });

  it("agrees with parseSettings on what is usable", () => {
    for (const saved of [
      { highContrast: "yes", colorblind: 1, fontScale: "huge" },
      { fontScale: "xlarge" },
      { highContrast: false, colorblind: true },
      {},
    ]) {
      const parsed = { ...defaultSettings, ...parseSettings(saved) };
      const root = document.createElement("html");
      applyDisplay(parsed, root);
      expect(run(JSON.stringify(saved))).toMatchObject({ ...root.dataset });
    }
  });

  it("follows the system's wish for more contrast only when nothing was saved", () => {
    expect(run(null, true).contrast).toBe("high");
    expect(run(null, false).contrast).toBe("normal");
    expect(run(JSON.stringify({ highContrast: false }), true).contrast).toBe("normal");
  });

  it("never breaks the page on unreadable storage", () => {
    expect(() => run("{not json")).not.toThrow();
    expect(run("{not json").contrast).toBeUndefined();
  });
});
