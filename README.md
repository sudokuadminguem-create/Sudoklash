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

## Vérifications

L'application est éditée et déployée sur la plateforme d'hébergement ; ce dépôt en est la copie.
Le `package.json` ne sert qu'aux vérifications, il ne change pas le build de la plateforme.

```sh
npm install
npm run check   # format, types, lint et tests (exécuté aussi par la CI GitHub)
```
