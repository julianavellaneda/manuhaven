#!/usr/bin/env sh
# Create .env from .env.example with fresh secrets, for docker-compose.yml.
#
#   ./scripts/setup.sh && docker compose up -d
#
# Fills POSTGRES_PASSWORD, BETTER_AUTH_SECRET, AI_KEY_ENCRYPTION_SECRET and
# CONVERTER_API_KEY. Never overwrites an existing .env: those secrets guard
# data that already exists (the database password, encrypted API keys).
set -eu

cd "$(dirname "$0")/.."

ENV_FILE=${1:-.env}

if [ -e "$ENV_FILE" ]; then
  echo "$ENV_FILE already exists; leaving it alone." >&2
  echo "Delete it first if you really want new secrets (existing data will not decrypt)." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secrets." >&2
  exit 1
fi

cp .env.example "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Hex keeps every value safe inside a URL (DATABASE_URL) and a sed expression.
set_var() {
  name=$1
  value=$(openssl rand -hex 32)
  if grep -q "^${name}=" "$ENV_FILE"; then
    sed -i.bak "s|^${name}=.*|${name}=${value}|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    printf '%s=%s\n' "$name" "$value" >>"$ENV_FILE"
  fi
}

for name in POSTGRES_PASSWORD BETTER_AUTH_SECRET AI_KEY_ENCRYPTION_SECRET CONVERTER_API_KEY; do
  set_var "$name"
done

echo "Wrote $ENV_FILE with generated secrets. Next:"
echo "  docker compose up -d"
echo "  open http://localhost:3000"
