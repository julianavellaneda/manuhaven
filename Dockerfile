# syntax=docker/dockerfile:1

# ---- deps -------------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Nothing about a deployment is baked in here. Browser-visible configuration is
# read at request time and injected into the document (lib/public-env.ts), so
# one image runs against any deployment.
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# The migrator runs under Node in the runtime image, outside the traced
# standalone output, so bundle it with its dependencies into one file.
# pg-native is an optional peer of pg that is never installed.
RUN bun build scripts/migrate.ts --target=node --format=esm \
      --external pg-native --outfile=dist/migrate.mjs

# ---- runtime ----------------------------------------------------------------
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/data/files

# /data/files is the storage volume's mount point; a named volume mounted
# there inherits this ownership on first use.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs manuhaven \
    && mkdir -p /data/files \
    && chown manuhaven:nodejs /data/files

# `output: "standalone"` produces server.js plus the traced dependencies.
COPY --from=builder --chown=manuhaven:nodejs /app/.next/standalone ./
COPY --from=builder --chown=manuhaven:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=manuhaven:nodejs /app/public ./public
COPY --from=builder --chown=manuhaven:nodejs /app/dist/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=manuhaven:nodejs /app/drizzle ./drizzle

USER manuhaven
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/health || exit 1

# Apply pending migrations, then hand PID 1 to the server.
CMD ["sh", "-c", "node migrate.mjs && exec node server.js"]
