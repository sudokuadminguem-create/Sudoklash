import { describe, expect, it } from "vitest";
import { detectLocale, hasMessage, levelName, translate, translator } from "@/app/lib/i18n-core";
import { cellPlace, personalRecord, shareText, verdictAnnouncement } from "@/app/lib/board-logic";
import { hintText, techniqueName } from "@/app/lib/hint-text";
import { en } from "@/app/lib/messages/en";
import { fr } from "@/app/lib/messages/fr";
import { soloDifficulties } from "@/lib/difficulties";
import { variantIds, variantInfo } from "@/lib/variants";
import { nextLogicalStep } from "@/lib/sudoku-grader";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogs", () => {
  it("have the same keys in both languages", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it("use the same placeholders in both languages", () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[])
      expect(placeholders(en[key]), key).toEqual(placeholders(fr[key]));
  });

  it("give every plural key its singular twin in both languages", () => {
    for (const key of Object.keys(fr).filter((k) => k.endsWith("_one")))
      expect(key.replace(/_one$/, "") in fr, key).toBe(true);
  });

  it("name every difficulty and variant", () => {
    for (const level of soloDifficulties) {
      expect(hasMessage(`level.${level}`)).toBe(true);
      expect(hasMessage(`levelHint.${level}`)).toBe(true);
    }
    for (const id of variantIds) {
      expect(hasMessage(`level.${variantInfo[id].label}`)).toBe(true);
      expect(hasMessage(`variant.${id}`)).toBe(true);
    }
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("fr", "keypad.place", { n: 7 })).toBe("Placer le chiffre 7");
    expect(translate("en", "keypad.place", { n: 7 })).toBe("Place digit 7");
    expect(translate("en", "keypad.place")).toBe("Place digit {n}");
    expect(translate("en", "keypad.place", { other: 1 })).toBe("Place digit {n}");
  });

  it("uses the singular only for a count of exactly one", () => {
    expect(translate("fr", "header.lives", { count: 1 })).toBe("1 vie restante sur 3");
    expect(translate("fr", "header.lives", { count: 0 })).toBe("0 vies restantes sur 3");
    expect(translate("en", "header.lives", { count: 1 })).toBe("1 life left out of 3");
    expect(translate("en", "header.lives", { count: 2 })).toBe("2 lives left out of 3");
  });

  it("names levels in the language, and shows unknown ones as they are", () => {
    expect(levelName(translator("en"), "Débutant")).toBe("Beginner");
    expect(levelName(translator("fr"), "Débutant")).toBe("Débutant");
    expect(levelName(translator("en"), "Inconnu")).toBe("Inconnu");
  });
});

describe("detectLocale", () => {
  it("prefers the saved choice, then the browser, then French", () => {
    expect(detectLocale("fr", "en-US")).toBe("fr");
    expect(detectLocale("en", "fr-FR")).toBe("en");
    expect(detectLocale(null, "en-GB")).toBe("en");
    expect(detectLocale(null, "de-DE")).toBe("fr");
    expect(detectLocale("xx", undefined)).toBe("fr");
  });
});

describe("board text in English", () => {
  const t = translator("en");
  it("announces verdicts, places and records", () => {
    expect(cellPlace(20, 9, t)).toBe("row 3, column 3");
    expect(
      verdictAnnouncement({ correct: true, number: 5, index: 20, size: 9, mistakes: 1 }, t),
    ).toBe("Digit 5 confirmed, row 3, column 3.");
    expect(
      verdictAnnouncement({ correct: false, number: 7, index: 0, size: 9, mistakes: 2 }, t),
    ).toBe("Digit 7 rejected, row 1, column 1. 1 life left.");
    expect(
      verdictAnnouncement({ correct: false, number: 7, index: 0, size: 9, mistakes: 3 }, t),
    ).toBe("Digit 7 rejected, row 1, column 1. No lives left: grid lost.");
    expect(personalRecord(200, 150, t)).toEqual({ label: "New record · −00:50", best: true });
    expect(personalRecord(null, 150, t)?.label).toBe("First record set");
    expect(
      shareText(
        { title: "Arena", difficulty: "Easy", time: "03:20", mistakes: 1, hintsUsed: 2 },
        t,
      ),
    ).toBe("Sudoku Clash · Arena Easy\n⏱ 03:20 ❤️❤️🤍 💡 2");
  });

  it("explains hints in English without leftover French", () => {
    const grid = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
      .split("")
      .map(Number);
    const step = nextLogicalStep(grid)!;
    const { title, text } = hintText(step.index, step, t);
    expect(title).toMatch(/single/i);
    expect(text).toMatch(/Look at/);
    expect(text).not.toMatch(/Regarde|ligne|colonne|bloc/);
    expect(hintText(40, null, t).text).toContain("row 5, column 5");
    expect(
      techniqueName(
        { technique: "nakedSubset", level: 3 as never, cells: [1, 2, 3], digits: [1, 2, 3] },
        t,
      ),
    ).toBe("Naked triple");
  });
});
