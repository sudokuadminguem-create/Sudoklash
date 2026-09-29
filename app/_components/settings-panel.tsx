"use client";
import { useI18n } from "@/app/lib/i18n";
import { locales, type MessageKey } from "@/app/lib/i18n-core";
import { defaultSettings, fontScales, useSettings, type Settings } from "@/app/lib/settings";

/** The settings that are a simple on/off switch. */
type Switch = Exclude<keyof Settings, "fontScale">;

const groups: { title: MessageKey; items: Switch[] }[] = [
  {
    title: "settings.group.grid",
    items: ["highlightUnits", "highlightSame", "autoRemoveNotes", "largeDigits"],
  },
  { title: "settings.group.display", items: ["highContrast", "colorblind"] },
  { title: "settings.group.game", items: ["showTimer", "confirmNewGrid", "vibrate"] },
];

/** Player preferences, saved on this device. */
export function SettingsPanel({ notify }: { notify: (s: string) => void }) {
  const { settings, update } = useSettings();
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="panel settings-panel">
      <div className="panel-head">
        <span className="eyebrow">{t("settings.eyebrow")}</span>
        <h2>{t("settings.title")}</h2>
        <p className="panel-copy">{t("settings.copy")}</p>
      </div>
      <section className="settings-group">
        <h3>{t("language.title")}</h3>
        <div className="setting-row" role="radiogroup" aria-labelledby="language-label">
          <span>
            <b id="language-label">{t("language.label")}</b>
            <small>{t("language.help")}</small>
          </span>
          <span className="language-choices">
            {locales.map((code) => (
              <button
                key={code}
                role="radio"
                aria-checked={locale === code}
                lang={code}
                className={locale === code ? "active" : ""}
                onClick={() => setLocale(code)}
              >
                {t(`language.${code}`)}
              </button>
            ))}
          </span>
        </div>
      </section>
      {groups.map((group) => (
        <section key={group.title} className="settings-group">
          <h3>{t(group.title)}</h3>
          {group.items.map((key) => (
            <label key={key} className="setting-row">
              <span>
                <b>{t(`settings.${key}` as MessageKey)}</b>
                <small>{t(`settings.${key}.help` as MessageKey)}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="setting-switch"
                checked={settings[key]}
                onChange={(e) => update({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </section>
      ))}
      <section className="settings-group">
        <h3>{t("settings.group.textSize")}</h3>
        <div className="setting-row font-scale-row">
          <span>
            <b>{t("settings.fontScale")}</b>
            <small>{t("settings.fontScale.help")}</small>
          </span>
          <div className="font-scale" role="radiogroup" aria-label={t("settings.group.textSize")}>
            {fontScales.map((scale) => (
              <button
                key={scale}
                role="radio"
                aria-checked={settings.fontScale === scale}
                className={settings.fontScale === scale ? "active" : ""}
                onClick={() => update({ fontScale: scale })}
              >
                {t(`fontScale.${scale}`)}
              </button>
            ))}
          </div>
        </div>
      </section>
      <button
        className="settings-reset"
        onClick={() => {
          update(defaultSettings);
          notify(t("shell.settingsReset"));
        }}
      >
        {t("settings.reset")}
      </button>
    </div>
  );
}
