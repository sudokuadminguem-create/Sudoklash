"use client";
import { useInstall } from "@/app/lib/pwa";
import {
  defaultSettings,
  fontScales,
  useSettings,
  type FontScale,
  type Settings,
} from "@/app/lib/settings";

/** The settings that are a simple on/off switch. */
type Switch = Exclude<keyof Settings, "fontScale">;

const fontScaleLabels: Record<FontScale, string> = {
  normal: "Normale",
  large: "Grande",
  xlarge: "Très grande",
};

const groups: { title: string; items: [Switch, string, string][] }[] = [
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
    title: "Affichage",
    items: [
      [
        "highContrast",
        "Contraste élevé",
        "Fond noir, texte blanc et bordures épaisses. Activé de lui-même si votre système le demande.",
      ],
      [
        "colorblind",
        "Mode daltonien",
        "Les erreurs sont marquées par une croix et des rayures, pas seulement par la couleur rouge.",
      ],
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
      <section className="settings-group">
        <h3>Taille du texte</h3>
        <div className="setting-row font-scale-row">
          <span>
            <b>Taille de l’affichage</b>
            <small>Agrandit tout ce qui est à l’écran, comme un zoom.</small>
          </span>
          <div className="font-scale" role="radiogroup" aria-label="Taille du texte">
            {fontScales.map((scale) => (
              <button
                key={scale}
                role="radio"
                aria-checked={settings.fontScale === scale}
                className={settings.fontScale === scale ? "active" : ""}
                onClick={() => update({ fontScale: scale })}
              >
                {fontScaleLabels[scale]}
              </button>
            ))}
          </div>
        </div>
      </section>
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
