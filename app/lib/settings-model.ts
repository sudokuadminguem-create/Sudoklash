// The player's settings without any React: the type, the defaults, how a saved entry is read,
// and how the display settings reach the page. No "use client" here, so the server layout can
// import the script that sets them before the first paint.

export const fontScales = ["normal", "large", "xlarge"] as const;
export type FontScale = (typeof fontScales)[number];

export const oneHandedModes = ["off", "right", "left"] as const;
export type OneHanded = (typeof oneHandedModes)[number];

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
  /** A short tick under the finger on every keypad press. */
  hapticKeys: boolean;
  largeDigits: boolean;
  /** Dock the keypad at the bottom of the screen, under the thumb of this hand. */
  oneHanded: OneHanded;
  /** Black and white, thick borders: for low vision and bright light. */
  highContrast: boolean;
  /** Errors and states shown with shapes and patterns, not red versus green. */
  colorblind: boolean;
  /** Size of everything on the page. */
  fontScale: FontScale;
};

export const defaultSettings: Settings = {
  highlightUnits: true,
  highlightSame: true,
  autoRemoveNotes: true,
  confirmNewGrid: true,
  showTimer: true,
  vibrate: false,
  hapticKeys: false,
  largeDigits: false,
  oneHanded: "off",
  highContrast: false,
  colorblind: false,
  fontScale: "normal",
};

export const STORAGE_KEY = "sudoklash:settings";

/**
 * The saved settings that are usable: known keys holding the right kind of value, so an old
 * or tampered entry is harmless.
 */
export function parseSettings(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== "object") return {};
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in defaultSettings)) continue;
    const valid =
      key === "fontScale"
        ? fontScales.includes(value as FontScale)
        : key === "oneHanded"
          ? oneHandedModes.includes(value as OneHanded)
          : typeof value === "boolean";
    if (valid) kept[key] = value;
  }
  return kept as Partial<Settings>;
}

/** Defaults a first-time visitor gets from what their system already asks for. */
export function preferredSettings(prefersMoreContrast: boolean): Partial<Settings> {
  return prefersMoreContrast ? { highContrast: true } : {};
}

/** Puts the display settings on the page, where themes.css reads them. */
export function applyDisplay(
  settings: Pick<Settings, "highContrast" | "colorblind" | "fontScale">,
  root: HTMLElement = document.documentElement,
) {
  root.dataset.contrast = settings.highContrast ? "high" : "normal";
  root.dataset.colorblind = settings.colorblind ? "on" : "off";
  root.dataset.fontScale = settings.fontScale;
}

/**
 * Runs in <head>, before the first paint, so the page never shows the default look for a moment.
 * It mirrors parseSettings and preferredSettings on the three display settings.
 */
export const displayScript = `try{var d=document.documentElement,s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)}),o=s?JSON.parse(s):{},h=s?o.highContrast===true:matchMedia("(prefers-contrast: more)").matches,f=o.fontScale;d.dataset.contrast=h?"high":"normal";d.dataset.colorblind=o.colorblind===true?"on":"off";d.dataset.fontScale=f==="large"||f==="xlarge"?f:"normal"}catch(e){}`;
