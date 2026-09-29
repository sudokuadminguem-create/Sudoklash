"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyDisplay,
  defaultSettings,
  parseSettings,
  preferredSettings,
  STORAGE_KEY,
  type Settings,
} from "./settings-model";

export {
  applyDisplay,
  defaultSettings,
  displayScript,
  fontScales,
  parseSettings,
  preferredSettings,
  type FontScale,
  type Settings,
} from "./settings-model";

type SettingsContext = { settings: Settings; update: (change: Partial<Settings>) => void };
const Context = createContext<SettingsContext>({ settings: defaultSettings, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  // Until the saved settings are read, the page keeps what the script in <head> gave it.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let next: Settings = defaultSettings;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      next = stored
        ? { ...defaultSettings, ...parseSettings(JSON.parse(stored)) }
        : {
            ...defaultSettings,
            ...preferredSettings(window.matchMedia?.("(prefers-contrast: more)").matches ?? false),
          };
    } catch {
      // Unreadable storage: defaults it is.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(next);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) applyDisplay(settings);
  }, [loaded, settings]);
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
