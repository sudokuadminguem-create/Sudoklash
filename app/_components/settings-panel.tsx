"use client";
import { useInstall } from "@/app/lib/pwa";
import { defaultSettings, useSettings, type Settings } from "@/app/lib/settings";

const groups: { title: string; items: [keyof Settings, string, string][] }[] = [
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
    ],
  },
];

/** Player preferences, saved on this device. */
export function SettingsPanel({ notify }: { notify: (s: string) => void }) {
  const { settings, update } = useSettings();
  const install = useInstall();
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
      {install && (
        <section className="settings-group">
          <h3>Application</h3>
          <div className="setting-row">
            <span>
              <b>Installer Sudoklash</b>
              <small>
                Ajoute l’icône à l’écran d’accueil ; le solo fonctionne aussi hors ligne.
              </small>
            </span>
            <button className="primary" onClick={() => void install()}>
              Installer
            </button>
          </div>
        </section>
      )}
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
