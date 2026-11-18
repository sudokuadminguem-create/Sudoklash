// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ElementalFrame } from "@/app/_components/elemental-frame";
import { mount } from "./support/render";

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

const scales = (svg: Element) =>
  [...svg.querySelectorAll(".element-ornament")].map(
    (g) => /scale\(([\d.]+)\)/.exec(g.getAttribute("transform")!)![1],
  );

describe("ElementalFrame", () => {
  it.each([0, 1, 2, 3, 4])("draws a closed crown outline for silhouette %i", async (variant) => {
    view = await mount(
      <ElementalFrame element={null} variant={variant} motif={0} legendary={false} />,
    );
    const base = view.container.querySelector(".element-base")!.getAttribute("d")!;
    const points = [24, 8, 32, 12, 20][variant];
    expect(base.match(/[ML]/g)).toHaveLength(points);
    expect(base.endsWith(" Z")).toBe(true);
    expect(view.container.querySelectorAll(".element-ornament")).toHaveLength(
      [3, 4, 6, 8, 10][variant],
    );
  });

  it("keeps a classic frame small and plain", async () => {
    view = await mount(<ElementalFrame element={null} variant={2} motif={1} legendary={false} />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("element-classic");
    expect(new Set(scales(svg))).toEqual(new Set(["0.57"]));
    expect(svg.querySelector(".element-signature")).toBeNull();
    expect(svg.querySelector(".element-halo")).toBeNull();
  });

  it("alternates ornament sizes and enlarges the signature of a legendary frame", async () => {
    view = await mount(<ElementalFrame element="frost" variant={3} motif={0} legendary />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("element-frost");
    expect(scales(svg).slice(0, 2)).toEqual(["1", "0.79"]);
    expect(svg.querySelector(".element-signature")!.getAttribute("transform")).toContain(
      "scale(1.15)",
    );
    // Outlined elements leave their ornaments hollow.
    expect(svg.querySelector(".element-ornament path")!.getAttribute("fill")).toBe("none");
    expect(svg.querySelectorAll(".element-particle")).toHaveLength(8);
  });

  it("gives an archetype its own crown and a smaller signature", async () => {
    view = await mount(<ElementalFrame element="angel" variant={0} motif={0} legendary={false} />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("archetype-art");
    expect(svg.querySelector(".archetype-crown")).not.toBeNull();
    expect(svg.querySelector(".element-signature")!.getAttribute("transform")).toContain(
      "scale(0.85)",
    );
    expect(svg.querySelector(".element-particles")).toBeNull();
  });

  it("uses the regular signature size for a plain element", async () => {
    view = await mount(<ElementalFrame element="fire" variant={1} motif={0} legendary={false} />);
    expect(view.container.querySelector(".element-signature")!.getAttribute("transform")).toContain(
      "scale(0.9)",
    );
  });
});
