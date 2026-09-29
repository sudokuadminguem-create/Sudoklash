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
    redo: vi.fn(),
    move: vi.fn(() => true),
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

  const keyOn = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  };

  it("moves the selection with the navigation keys and keeps the page from scrolling", async () => {
    const h = handlers();
    await act(async () => root.render(<Shortcuts {...h} />));
    for (const key of ["ArrowUp", "ArrowLeft", "Home", "End", "PageUp", "PageDown"]) {
      const event = keyOn(document.body, key);
      expect(h.move).toHaveBeenLastCalledWith(key);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(h.move).toHaveBeenCalledTimes(6);
  });

  it("leaves the key alone when nothing moved", async () => {
    const h = handlers();
    h.move = vi.fn(() => false);
    await act(async () => root.render(<Shortcuts {...h} />));
    expect(keyOn(document.body, "ArrowDown").defaultPrevented).toBe(false);
  });

  it("moves from inside the grid but not from menus, dialogs or fields", async () => {
    const h = handlers();
    document.body.innerHTML =
      '<div class="sudoku"><button id="cell"></button></div><button id="menu"></button><input id="field">';
    await act(async () => root.render(<Shortcuts {...h} />));
    keyOn(document.getElementById("cell")!, "ArrowRight");
    expect(h.move).toHaveBeenCalledTimes(1);
    keyOn(document.getElementById("menu")!, "ArrowRight");
    keyOn(document.getElementById("field")!, "ArrowRight");
    expect(h.move).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "";
  });

  it("does not steal the browser's shortcuts", async () => {
    const h = handlers();
    await act(async () => root.render(<Shortcuts {...h} />));
    keyOn(document.body, "ArrowLeft", { ctrlKey: true });
    keyOn(document.body, "ArrowLeft", { metaKey: true });
    keyOn(document.body, "ArrowLeft", { altKey: true });
    expect(h.move).not.toHaveBeenCalled();
  });
});
