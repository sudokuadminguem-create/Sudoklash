import { Crown, Trophy } from "lucide-react";

// Placeholder content: this view is not linked from the navigation yet.

export function Tournaments({ notify }: { notify: (s: string) => void }) {
  return (
    <div>
      <div className="feature-tourney">
        <div>
          <span className="live">
            <i />
            INSCRIPTIONS OUVERTES
          </span>
          <h2>Open Arena #42</h2>
          <p>64 joueurs · Élimination directe · Expert</p>
          <div>
            <b>
              20 000 <small>Sudokoins</small>
            </b>
            <span>Début dans 02:14:32</span>
          </div>
          <button onClick={() => notify("Inscription confirmée à l’Open Arena #42")}>
            <Trophy />
            S’inscrire au tournoi
          </button>
        </div>
        <Crown />
      </div>
      <div className="cards3">
        {[
          ["Sprint du mercredi", "32 joueurs", "Intermédiaire", "Ce soir · 20:00"],
          ["Masters nocturne", "128 joueurs", "Maître", "Vendredi · 22:00"],
          ["Coupe des clubs", "Équipes de 4", "Avancé", "Dimanche · 15:00"],
        ].map((t) => (
          <article className="card" key={t[0]}>
            <Trophy />
            <h3>{t[0]}</h3>
            <p>
              {t[1]} · {t[2]}
            </p>
            <b>{t[3]}</b>
            <button onClick={() => notify(`Inscription confirmée : ${t[0]}`)}>
              Voir le tournoi
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
