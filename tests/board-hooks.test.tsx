// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardShortcuts, useGameClock, type BoardShortcuts } from "@/app/lib/board-hooks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

function Clock({ running, initial = 0 }: { running: boolean; initial?: number }) {
  return <output>{useGameClock(initial, running)}</output>;
}
const shown = () => container.querySelector("output")!.textContent;

describe("useGameClock", () => {
  it("counts seconds from the initial value while running", async () => {
    await act(async () => root.render(<Clock running initial={40} />));
    await act(async () => vi.advanceTimersByTime(3000));
    expect(shown()).toBe("43");
  });

  it("stops while paused and carries on from where it was", async () => {
    await act(async () => root.render(<Clock running />));
    await act(async () => vi.advanceTimersByTime(2000));
    await act(async () => root.render(<Clock running={false} />));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(shown()).toBe("2");
    await act(async () => root.render(<Clock running />));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(shown()).toBe("3");
  });
});

function Shortcuts(props: BoardShortcuts) {
  useBoardShortcuts(props);
  return null;
}
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
  });

describe("useBoardShortcuts", () => {
  const handlers = () => ({
    digit: vi.fn(),
    erase: vi.fn(),
    toggleNotes: vi.fn(),
    undo: vi.fn(),
  });

  it("maps keys to actions", async () => {
    const h = handlers();
    await act(async () => root.render(<Shortcuts {...h} />));
    await press("7");
    await press("Backspace");
    await press("Delete");
    await press("n");
    await press("z", { ctrlKey: true });
    await press("z", { metaKey: true });
    expect(h.digit).toHaveBeenCalledWith(7);
    expect(h.erase).toHaveBeenCalledTimes(2);
    expect(h.toggleNotes).toHaveBeenCalledTimes(1);
    expect(h.undo).toHaveBeenCalledTimes(2);
  });

  it("ignores other keys, including 0 and a plain z", async () => {
    const h = handlers();
    await act(async () => root.render(<Shortcuts {...h} />));
    for (const key of ["0", "a", "Enter"]) await press(key);
    await press("z");
    expect(h.digit).not.toHaveBeenCalled();
    expect(h.undo).not.toHaveBeenCalled();
  });

  it("always calls the latest handlers and stops listening once unmounted", async () => {
    const first = handlers();
    const second = handlers();
    await act(async () => root.render(<Shortcuts {...first} />));
    await act(async () => root.render(<Shortcuts {...second} />));
    await press("3");
    expect(first.digit).not.toHaveBeenCalled();
    expect(second.digit).toHaveBeenCalledWith(3);
    await act(async () => root.unmount());
    await press("4");
    expect(second.digit).toHaveBeenCalledTimes(1);
    root = createRoot(container); // for afterEach
  });
});
