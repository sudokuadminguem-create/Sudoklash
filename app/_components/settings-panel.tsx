"use client";
import { defaultSettings, useSettings, type OneHanded } from "@/app/lib/settings";

type ToggleKey =
  | "highlightUnits"
  | "highlightSame"
  | "autoRemoveNotes"
  | "largeDigits"
  | "showTimer"
  | "confirmNewGrid"
  | "vibrate"
  | "hapticKeys";

const hands: [OneHanded, string][] = [
  ["off", "Désactivé"],
  ["right", "Main droite"],
  ["left", "Main gauche"],
];

const groups: { title: string; items: [ToggleKey, string, string][] }[] = [
  {
    title: "Grille",
    items: [
      [
        "highlightUnits",
        "Surligner ligne, colonne et bloc",
        "Met en évidence les cases liées à la case sélectionnée.",
      ],
      [
        "highlightSame",
        "Surligner les chiffres identiques",
        "Fait ressortir toutes les cases qui contiennent le chiffre sélectionné.",
      ],
      [
        "autoRemoveNotes",
        "Nettoyer les notes automatiquement",
        "Un chiffre posé disparaît des notes de sa ligne, de sa colonne et de son bloc.",
      ],
      ["largeDigits", "Grands chiffres", "Agrandit les chiffres de la grille et des notes."],
    ],
  },
  {
    title: "Partie",
    items: [
      ["showTimer", "Afficher le chronomètre", "Le temps reste mesuré même quand il est masqué."],
      [
        "confirmNewGrid",
        "Confirmer avant une nouvelle grille",
        "Demande une confirmation avant d’abandonner une grille commencée.",
      ],
      [
        "vibrate",
        "Vibrer en cas d’erreur",
        "Sur les appareils qui le permettent, surtout les téléphones.",
      ],
      [
        "hapticKeys",
        "Retour haptique du clavier",
        "Un léger tic à chaque chiffre posé. Non disponible sur iPhone.",
      ],
    ],
  },
];

/** Player preferences, saved on this device. */
export function SettingsPanel({ notify }: { notify: (s: string) => void }) {
  const { settings, update } = useSettings();
  return (
    <div className="panel settings-panel">
      <div className="panel-head">
        <span className="eyebrow">PRÉFÉRENCES</span>
        <h2>Paramètres de jeu</h2>
        <p className="panel-copy">Ces réglages sont enregistrés sur cet appareil.</p>
      </div>
      {groups.map((group) => (
        <section key={group.title} className="settings-group">
          <h3>{group.title}</h3>
          {group.items.map(([key, label, help]) => (
            <label key={key} className="setting-row">
              <span>
                <b>{label}</b>
                <small>{help}</small>
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
        <h3>Mobile</h3>
        <div className="setting-row one-handed" role="radiogroup" aria-labelledby="one-handed">
          <span>
            <b id="one-handed">Mode une main</b>
            <small>Range le clavier en bas de l’écran, à portée du pouce.</small>
          </span>
          <span className="hand-choices">
            {hands.map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={settings.oneHanded === value}
                className={settings.oneHanded === value ? "active" : ""}
                onClick={() => update({ oneHanded: value })}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
      </section>
      <button
        className="settings-reset"
        onClick={() => {
          update(defaultSettings);
          notify("Paramètres par défaut rétablis");
        }}
      >
        Rétablir les réglages par défaut
      </button>
    </div>
  );
}
