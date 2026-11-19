// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VictoryPanel } from "@/app/_components/board/game-results";
import type { ExperienceState } from "@/app/_components/board/types";
import { mount } from "./support/render";

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

const render = (experience: ExperienceState, extra: { onConnect?: () => void } = {}) =>
  mount(
    <VictoryPanel
      difficulty="Facile"
      time="04:12"
      mistakes={1}
      hintsUsed={0}
      record={null}
      soloExperience
      experience={experience}
      experienceTotal={experience === 40 ? 340 : null}
      shareText="Sudoku Clash"
      onNewGame={() => {}}
      {...extra}
    />,
  );

describe("VictoryPanel solo experience", () => {
  it("celebrates the XP earned and shows the progress", async () => {
    view = await render(40);
    const xp = view.container.querySelector(".solo-xp")!;
    expect(xp.textContent).toContain("+40 XP");
    expect(xp.textContent).toContain("Expérience ajoutée à ton compte");
    expect(xp.querySelector("progress")).not.toBeNull();
  });

  it("says the result is being saved and holds the next grid back", async () => {
    view = await render("saving");
    expect(view.container.querySelector(".solo-xp")!.textContent).toBe(
      "Enregistrement de ton expérience…",
    );
    const next = [...view.container.querySelectorAll("button")].at(-1)!;
    expect(next.disabled).toBe(true);
  });

  it("invites a guest to sign in for XP", async () => {
    const onConnect = vi.fn();
    view = await render("guest", { onConnect });
    expect(view.container.textContent).toContain("Connecte-toi pour gagner de l’XP");
    act(() => view!.container.querySelector<HTMLButtonElement>(".solo-xp-connect")!.click());
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("tells a guest without a sign-in link that no XP is earned", async () => {
    view = await render("guest");
    expect(view.container.querySelector(".solo-xp-connect")).toBeNull();
  });

  it("reports a result that could not be saved", async () => {
    view = await render("error");
    expect(view.container.textContent).toContain("Résultat non enregistré");
  });

  it("shows nothing when there is no experience to report", async () => {
    view = await render(null);
    expect(view.container.querySelector(".solo-xp")!.textContent).toBe("");
  });
});
