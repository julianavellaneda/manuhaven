#!/usr/bin/env bash
# HTML (+ cover) -> converter HTTP API -> EPUB/PDF bytes -> epubcheck, against
# the real converter container. Not part of `bun run test`: needs Docker and a
# JRE.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE=manuhaven-converter
CONTAINER=manuhaven-converter-test
PORT="${CONVERTER_TEST_PORT:-3901}"
KEY=test-secret
URL="http://127.0.0.1:$PORT"
EPUBCHECK_VERSION=5.1.0
WORK="$(mktemp -d)"
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

echo "==> Building $IMAGE"
docker build -q -t "$IMAGE" "$ROOT/services/converter" >/dev/null

echo "==> Starting container"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --rm --name "$CONTAINER" -p "127.0.0.1:$PORT:3001" \
  -e CONVERTER_API_KEY="$KEY" "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  curl -sf "$URL/health" >/dev/null 2>&1 && break
  sleep 1
done
echo "==> Health: $(curl -s "$URL/health")"

HTML='<h1>Chapter One</h1><p>The pier at dawn, and Elena counting boats.</p><h1>Chapter Two</h1><p>By noon the fog had burned off entirely.</p>'
META='{"title":"Tides","authorName":"A. Novelist","language":"en"}'
# A 1x1 PNG: enough for Pandoc to package a cover.
COVER='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

# post <path> <json> <outfile> [key] -> prints the HTTP status
post() {
  curl -s -o "$3" -w '%{http_code}' -X POST "$URL$1" \
    -H "Authorization: Bearer ${4:-$KEY}" \
    -H "Content-Type: application/json" \
    --data-binary "$2"
}

expect_status() {
  if [ "$2" != "$1" ]; then
    echo "FAILED: $3: expected HTTP $1, got $2" >&2
    cat "$WORK/body" >&2 2>/dev/null || true
    exit 1
  fi
}

echo "==> Contract checks"
expect_status 401 "$(post /convert/epub '{}' "$WORK/body" wrong-key)" "wrong key"
expect_status 400 "$(post /convert/epub "{\"html\":\"x\",\"metadata\":$META,\"templateId\":\"../etc\"}" "$WORK/body")" "bad template"
expect_status 400 "$(post /convert/epub "{\"html\":\"x\",\"metadata\":$META,\"templateId\":\"literary\",\"cover\":{\"base64\":\"x\",\"contentType\":\"image/svg+xml\"}}" "$WORK/body")" "svg cover"
expect_status 400 "$(post /convert/epub '{not json' "$WORK/body")" "malformed JSON"
expect_status 400 "$(post /convert/pdf "{\"html\":\"x\",\"metadata\":$META,\"templateId\":\"literary\"}" "$WORK/body")" "pdf without printSettings"

echo "==> Converting"
expect_status 200 "$(post /convert/epub \
  "{\"html\":\"$HTML\",\"metadata\":$META,\"templateId\":\"literary\",\"cover\":{\"base64\":\"$COVER\",\"contentType\":\"image/png\"}}" \
  "$WORK/out.epub")" "EPUB"
echo "EPUB bytes: $(wc -c <"$WORK/out.epub" | tr -d ' ')"
unzip -l "$WORK/out.epub" | grep 'media/cover\.png' >/dev/null || { echo "FAILED: EPUB has no cover image" >&2; exit 1; }

expect_status 200 "$(post /convert/pdf \
  "{\"html\":\"$HTML\",\"metadata\":$META,\"templateId\":\"literary\",\"printSettings\":{\"trimSize\":\"6x9\",\"margins\":\"normal\",\"fontSize\":\"medium\"}}" \
  "$WORK/out.pdf")" "PDF"
echo "PDF bytes: $(wc -c <"$WORK/out.pdf" | tr -d ' ')"
[ "$(head -c 5 "$WORK/out.pdf")" = "%PDF-" ] || { echo "FAILED: not a PDF" >&2; exit 1; }

echo "==> Checking the logs hold no manuscript text"
# Not `grep -q`: with pipefail, its early exit would SIGPIPE docker logs and
# read as "not found".
if docker logs "$CONTAINER" 2>&1 | grep 'Elena' >/dev/null; then
  echo "FAILED: manuscript text in converter logs" >&2
  exit 1
fi

echo "==> Validating with epubcheck $EPUBCHECK_VERSION"
curl -sL -o "$WORK/ec.zip" \
  "https://github.com/w3c/epubcheck/releases/download/v${EPUBCHECK_VERSION}/epubcheck-${EPUBCHECK_VERSION}.zip"
unzip -q -o "$WORK/ec.zip" -d "$WORK"
java -jar "$WORK/epubcheck-${EPUBCHECK_VERSION}/epubcheck.jar" "$WORK/out.epub"
echo "==> OK"
