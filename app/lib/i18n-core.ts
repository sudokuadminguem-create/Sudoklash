// Translation without React, so pure modules (board rules, hints) can produce localised text.

import { en } from "./messages/en";
import { fr, type MessageKey } from "./messages/fr";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
export const LOCALE_KEY = "sudoklash:locale";

export type { MessageKey };
export type Params = Record<string, string | number>;
/** Looks a message up in the current language. */
export type Translate = (key: MessageKey, params?: Params) => string;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { fr, en };

export const isLocale = (value: unknown): value is Locale =>
  (locales as readonly unknown[]).includes(value);

/** The language to start in: the saved choice, else the browser's, else French. */
export function detectLocale(
  saved: string | null | undefined,
  browser: string | undefined,
): Locale {
  if (isLocale(saved)) return saved;
  return browser?.toLowerCase().startsWith("en") ? "en" : defaultLocale;
}

/**
 * The message for `key`, with `{name}` placeholders filled from `params`. When `params.count` is
 * given and a `key_one` variant exists, that variant is used for a count of exactly one.
 */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const dictionary = dictionaries[locale];
  let id: string = key;
  if (typeof params?.count === "number") {
    const one = `${key}_one` as MessageKey;
    if (params.count === 1 && one in dictionary) id = one;
  }
  const text = dictionary[id as MessageKey] ?? fr[id as MessageKey] ?? key;
  return params
    ? text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? String(params[name]) : whole,
      )
    : text;
}

/** Whether a message exists under this key, for keys built from data (levels, variants). */
export const hasMessage = (key: string): key is MessageKey => key in fr;

/** A difficulty or variant name in the current language; unknown names are shown as they are. */
export function levelName(t: Translate, name: string) {
  const key = `level.${name}`;
  return hasMessage(key) ? t(key) : name;
}

export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    translate(locale, key, params);

/** French, which every message is written in first. */
export const tFr = translator("fr");
