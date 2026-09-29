// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/app/_components/settings-panel";
import { SettingsProvider } from "@/app/lib/settings";
import { STORAGE_KEY } from "@/app/lib/settings-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.contrast;
  delete document.documentElement.dataset.colorblind;
  delete document.documentElement.dataset.fontScale;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const html = () => document.documentElement.dataset;
const saved = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
const render = (notify = vi.fn()) =>
  act(async () =>
    root.render(
      <SettingsProvider>
        <SettingsPanel notify={notify} />
      </SettingsProvider>,
    ),
  );
const switchFor = (label: string) =>
  [...container.querySelectorAll<HTMLLabelElement>("label.setting-row")]
    .find((row) => row.textContent?.includes(label))!
    .querySelector<HTMLInputElement>("input")!;
const scale = (label: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('.font-scale [role="radio"]')].find(
    (b) => b.textContent === label,
  )!;

describe("display settings", () => {
  it("offers contrast, colour-blind mode and text size in an « Affichage » group", async () => {
    await render();
    const groups = [...container.querySelectorAll(".settings-group h3")].map((h) => h.textContent);
    expect(groups).toEqual([
      "Langue",
      "Grille",
      "Affichage",
      "Partie",
      "Mobile",
      "Taille du texte",
    ]);
    expect(switchFor("Contraste élevé").checked).toBe(false);
    expect(switchFor("Mode daltonien").checked).toBe(false);
    expect([...container.querySelectorAll(".font-scale button")].map((b) => b.textContent)).toEqual(
      ["Normale", "Grande", "Très grande"],
    );
    expect(scale("Normale").getAttribute("aria-checked")).toBe("true");
  });

  it("switches high contrast on the page and remembers it", async () => {
    await render();
    await act(async () => switchFor("Contraste élevé").click());
    expect(html().contrast).toBe("high");
    expect(saved().highContrast).toBe(true);
    await act(async () => switchFor("Contraste élevé").click());
    expect(html().contrast).toBe("normal");
  });

  it("switches colour-blind mode", async () => {
    await render();
    await act(async () => switchFor("Mode daltonien").click());
    expect(html().colorblind).toBe("on");
    expect(saved().colorblind).toBe(true);
  });

  it("changes the text size, one choice at a time", async () => {
    await render();
    await act(async () => scale("Très grande").click());
    expect(html().fontScale).toBe("xlarge");
    expect(scale("Très grande").getAttribute("aria-checked")).toBe("true");
    expect(scale("Normale").getAttribute("aria-checked")).toBe("false");
    expect(saved().fontScale).toBe("xlarge");
    await act(async () => scale("Grande").click());
    expect(html().fontScale).toBe("large");
  });

  it("restores the saved display on the next visit", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ highContrast: true, colorblind: true, fontScale: "large" }),
    );
    await render();
    expect(html()).toMatchObject({ contrast: "high", colorblind: "on", fontScale: "large" });
    expect(switchFor("Contraste élevé").checked).toBe(true);
    expect(scale("Grande").getAttribute("aria-checked")).toBe("true");
  });

  it("ignores a saved text size it does not know", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fontScale: "gigantic", highContrast: 1 }),
    );
    await render();
    expect(html()).toMatchObject({ contrast: "normal", fontScale: "normal" });
  });

  it("starts in high contrast for a visitor whose system asks for more contrast", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-contrast: more"),
    }));
    await render();
    expect(html().contrast).toBe("high");
    expect(switchFor("Contraste élevé").checked).toBe(true);
  });

  it("lets a saved choice win over the system's wish", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ highContrast: false }));
    await render();
    expect(html().contrast).toBe("normal");
  });

  it("puts the display back to normal with the reset button", async () => {
    const notify = vi.fn();
    await render(notify);
    await act(async () => switchFor("Contraste élevé").click());
    await act(async () => switchFor("Mode daltonien").click());
    await act(async () => scale("Grande").click());
    await act(async () => container.querySelector<HTMLButtonElement>(".settings-reset")!.click());
    expect(html()).toMatchObject({ contrast: "normal", colorblind: "off", fontScale: "normal" });
    expect(notify).toHaveBeenCalled();
  });
});
