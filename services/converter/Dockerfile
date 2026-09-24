FROM node:24-slim

# Pandoc builds the EPUB, WeasyPrint renders the PDF; the font packages are
# what the genre templates fall back to. curl is used by the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    pandoc \
    weasyprint \
    fonts-liberation \
    fonts-noto-core \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# The `node` user ships with the base image; fontconfig caches under its home.
RUN mkdir -p /home/node/.cache/fontconfig && chown -R node:node /home/node /app
USER node

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["node", "index.js"]
