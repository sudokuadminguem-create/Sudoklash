"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Player preferences, kept on this device. */
export type Settings = {
  /** Shade the row, column and box of the selected cell. */
  highlightUnits: boolean;
  /** Brighten every cell holding the selected digit. */
  highlightSame: boolean;
  /** Drop a placed digit from the notes of its row, column and box. */
  autoRemoveNotes: boolean;
  /** Ask before a new grid throws away the one in progress. */
  confirmNewGrid: boolean;
  showTimer: boolean;
  /** Vibrate on a wrong digit, where the device can. */
  vibrate: boolean;
  largeDigits: boolean;
};

export const defaultSettings: Settings = {
  highlightUnits: true,
  highlightSame: true,
  autoRemoveNotes: true,
  confirmNewGrid: true,
  showTimer: true,
  vibrate: false,
  largeDigits: false,
};

const STORAGE_KEY = "sudoklash:settings";

type SettingsContext = { settings: Settings; update: (change: Partial<Settings>) => void };
const Context = createContext<SettingsContext>({ settings: defaultSettings, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as object;
      // Keep only known keys with the right type, so an old or tampered value is harmless.
      const known = Object.fromEntries(
        Object.entries(saved).filter(
          ([key, value]) => key in defaultSettings && typeof value === "boolean",
        ),
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings({ ...defaultSettings, ...known });
    } catch {
      // Unreadable storage: defaults it is.
    }
  }, []);
  const update = useCallback((change: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...change };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not saved, but still applied for this visit.
      }
      return next;
    });
  }, []);
  return <Context.Provider value={{ settings, update }}>{children}</Context.Provider>;
}

/** Current settings; the defaults outside a SettingsProvider. */
export const useSettings = () => useContext(Context);
