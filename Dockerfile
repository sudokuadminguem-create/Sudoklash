# syntax=docker/dockerfile:1

# Self-hosted image of Sudoku Clash: Next.js standalone server on Node, SQLite database in
# a volume. The base image is pinned by digest (Dependabot keeps it up to date).
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

# ---------- Étape 1 : dépendances ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts : aucun script d'installation de paquet tiers n'est exécuté.
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---------- Étape 2 : build Next.js (standalone) ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Réglages publics Supabase, intégrés au code envoyé au navigateur (valeurs par défaut dans
# lib/supabase-config.ts). Ce ne sont pas des secrets.
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Étape 3 : image d'exécution ----------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

# Correctifs de sécurité Alpine, tini pour relayer les signaux et récupérer les zombies,
# puis retrait des gestionnaires de paquets (apk, npm, yarn, corepack), inutiles à
# l'exécution et utiles à un attaquant.
RUN apk upgrade --no-cache \
 && apk add --no-cache tini \
 && apk del --purge apk-tools \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/sudoklash.db \
    MIGRATIONS_DIR=/app/drizzle \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

# Le code appartient à root et reste en lecture seule pour l'utilisateur qui exécute l'app ;
# seul /app/data (la base SQLite) lui est accessible en écriture.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY drizzle ./drizzle
COPY docker/healthcheck.mjs ./healthcheck.mjs
RUN mkdir -p /app/data /app/.next/cache && chown node:node /app/data /app/.next/cache

USER node
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "healthcheck.mjs"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
