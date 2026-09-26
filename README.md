# Sudoklash

Jeu de sudoku en compétition

## Organisation du code

| Dossier            | Contenu                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`     | Page principale : navigation et assemblage des vues                                                     |
| `app/_components/` | Composants d'interface (grille, défis, classé, compte, boutique…). Dossier privé, non routé par Next.js |
| `app/lib/`         | Utilitaires côté navigateur : client Supabase, en-têtes d'authentification, formatage du temps          |
| `app/api/`         | Routes API (Cloudflare Workers + D1)                                                                    |
| `hooks/`           | Hooks React partagés (`useAccount`, `useCosmetics`…)                                                    |
| `lib/`             | Logique métier partagée navigateur/serveur : solveur de sudoku, règles du classé, cosmétiques, défis    |
| `db/`, `drizzle/`  | Schéma et migrations de la base D1                                                                      |
| `components/ui/`   | Composants shadcn/ui fournis par le modèle de projet                                                    |

## Conventions

- Le code est formaté avec Prettier (`.prettierrc.json`) : `npx prettier --write .`
- Un composant par fichier, nommé en kebab-case (`sudoku-board.tsx` exporte `SudokuBoard`).
- Les appels à l'API passent l'en-tête d'authentification via `authHeaders()` (`app/lib/auth-headers.ts`).
- La logique pure (sans dépendance au navigateur ni à Cloudflare) va dans `lib/` pour être partagée.
- En solo (joueur connecté), en classé et dans les défis, le navigateur ne reçoit jamais la solution : chaque chiffre est vérifié par le serveur (action `check`).
- Les migrations sont générées depuis `db/schema.ts` avec `npm run db:generate`.

## Vérifications

L'application est éditée et déployée sur la plateforme d'hébergement ; ce dépôt en est la copie.
Le `package.json` ne sert qu'aux vérifications, il ne change pas le build de la plateforme.

```sh
npm install
npm run check   # format, types, lint et tests (exécuté aussi par la CI GitHub)
```

## Auto-hébergement (Docker)

```sh
cp .env.example .env        # facultatif : port, adresse d'écoute, projet Supabase
docker compose up -d --build
```

L'application écoute sur `127.0.0.1:3000` ; placez un reverse proxy TLS devant (Caddy, Traefik,
nginx). Dans ce mode :

- la base D1 est remplacée par un fichier SQLite dans le volume `data` (migrations `drizzle/`
  appliquées au démarrage) ; sauvegardez ce volume ;
- seule la connexion Supabase est acceptée : les en-têtes d'identité de la plateforme
  (`oai-authenticated-*`) sont ignorés, car n'importe qui pourrait les envoyer ;
- la configuration propre à Docker (`next.config.ts`, `postcss.config.mjs`) ne s'active qu'avec
  `SUDOKLASH_SELF_HOSTED=1`, posé par le Dockerfile : la plateforme, qui lit aussi ces fichiers,
  garde D1, sa connexion ChatGPT et ses propres en-têtes ;
- le conteneur tourne sans root, en lecture seule, sans capacités Linux, sans npm ni apk, avec des
  en-têtes de sécurité (CSP, HSTS, anti-framing) et une sonde `/api/health`.
