#!/usr/bin/env bash
# Retakes the README screenshots in docs/images/ from a running dev server
# with the demo account:
#
#   bun run db:up && bun run db:migrate && bun run db:seed
#   bun run dev                          # in another terminal
#   ./scripts/readme-screenshots.sh      # BASE_URL overrides http://localhost:3000
#
# Needs playwright-cli (npm i -g @playwright/cli) and cwebp (brew install webp).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/docs/images"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

cat > "$TMP/capture.js" <<JS
async page => {
  const base = "$BASE_URL";
  const tmp = "$TMP";
  // A fresh 2x context, so the images stay sharp on high-density screens.
  const context = await page.context().browser().newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const p = await context.newPage();

  await p.goto(base + "/login");
  await p.getByLabel("Email").fill("demo@example.com");
  await p.getByLabel("Password").fill("manuhaven-demo");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL("**/dashboard");

  const href = await p
    .getByRole("link", { name: /Pride and Prejudice/ })
    .first()
    .getAttribute("href");
  const project = href.match(/projects\/([0-9a-f-]+)/)[1];

  async function shot(path, name) {
    await p.goto(base + path);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(1500);
    // The Next.js dev-tools badge.
    await p.evaluate(() =>
      document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()),
    );
    await p.screenshot({ path: tmp + "/" + name + ".png" });
  }

  await shot("/dashboard/projects/" + project + "/edit", "editor");
  await shot("/dashboard", "dashboard");
  await shot("/dashboard/projects/" + project + "/editorial", "editorial");
  await shot("/dashboard/projects/" + project + "/preview", "preview");
  await shot("/dashboard/royalties", "royalties");

  await context.close();
}
JS

playwright-cli open >/dev/null
playwright-cli run-code --filename="$TMP/capture.js"

for png in "$TMP"/*.png; do
  cwebp -quiet -q 82 "$png" -o "$OUT/$(basename "${png%.png}").webp"
done
echo "Wrote $(ls "$TMP"/*.png | wc -l | tr -d ' ') screenshots to $OUT"
