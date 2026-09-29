// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ExperienceProgress } from "@/app/_components/experience-progress";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows earned XP and the correct level after crossing a level boundary", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<ExperienceProgress gained={40} totalXp={120} />));
  expect(container.textContent).toContain("Niveau 2 atteint !");
  expect(container.textContent).toContain("+40 XP");
  expect(container.textContent).toContain("20 / 300 XP vers le niveau 3");
  const bar = container.querySelector("[role=progressbar]")!;
  expect(bar.getAttribute("aria-valuenow")).toBe("20");
  expect(bar.getAttribute("aria-valuemax")).toBe("300");
  act(() => root.unmount());
});
