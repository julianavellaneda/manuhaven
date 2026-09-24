#!/usr/bin/env bash
# One-time repository setup: labels, Discussions, and the starter issues.
# Idempotent -- rerunning it updates labels and skips issues that already exist.
#
#   gh auth login
#   scripts/gh-bootstrap.sh [owner/repo]
#
# With no argument it uses the repository the current directory points at.
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Repository: $REPO"

# --- labels ------------------------------------------------------------------
echo "==> Labels"
python3 - "$ROOT/.github/labels.yml" <<'PY' | while IFS=$'\t' read -r name color desc; do
import re, sys
text = open(sys.argv[1]).read()
entries, cur = [], None
for line in text.splitlines():
    m = re.match(r'^- name: "?([^"]+)"?\s*$', line)
    if m:
        cur = {"name": m.group(1)}
        entries.append(cur)
        continue
    m = re.match(r'^  (color|description): "?(.*?)"?\s*$', line)
    if m and cur:
        cur[m.group(1)] = m.group(2)
for e in entries:
    print("\t".join([e["name"], e.get("color", "ededed"), e.get("description", "")]))
PY
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force >/dev/null
  echo "    $name"
done

# --- discussions -------------------------------------------------------------
echo "==> Enabling Discussions"
gh api -X PATCH "repos/$REPO" -F has_discussions=true >/dev/null

# --- starter issues ----------------------------------------------------------
# Small, self-contained, and genuinely useful -- the kind of thing a first-time
# contributor can finish in an evening.
echo "==> Starter issues"
existing="$(gh issue list --repo "$REPO" --state all --limit 200 --json title -q '.[].title')"

open_issue() {
  local title="$1" labels="$2" body="$3"
  if grep -Fxq "$title" <<<"$existing"; then
    echo "    skip (exists): $title"
    return
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body" >/dev/null
  echo "    created: $title"
}

open_issue "Add a sixth genre CSS template" "good first issue,area:export,help wanted" \
"\`services/converter/templates/\` holds one stylesheet per genre (fantasy,
literary, romance, scifi, thriller), and \`VALID_TEMPLATES\` in
\`services/converter/index.js\` lists them. Add a sixth -- historical, horror,
young adult, or a proposal of your own.

The CSS contract is in \`services/converter/README.md\`: self-contained, no
\`@import\`, no web fonts, styling the semantic elements Pandoc emits.

Also needs: the template's name in \`messages/en.json\` and \`messages/es.json\`,
and a before/after screenshot of the rendered PDF in the PR."

open_issue "Review the es-MX copy in Settings" "good first issue,area:i18n,help wanted" \
"The Spanish interface was written by one person and the Settings screens are
the densest part of it. Read the \`settings.*\` keys in \`messages/es.json\`
against \`i18n/STYLE_GUIDE.md\` and fix anything stiff, over-literal, or
inconsistent with the terminology table.

Native or fluent Mexican Spanish, please. Keys must stay in exact parity with
\`messages/en.json\` -- \`bun run test\` enforces that."

open_issue "Show a friendlier error when the converter is unreachable" "good first issue,area:export" \
"If \`CONVERTER_URL\` points nowhere, the export routes surface a generic
failure. It should say the export service is not running and link to
\`docs/self-hosting.md\`, which is by far the most likely cause for someone
who has just set the project up.

Start at \`app/api/convert/epub/route.ts\` and the preview page's error
handling. Strings go in both locale files."

open_issue "Add a word-count goal to the writing stats panel" "good first issue,area:editor,enhancement" \
"The editor reports words, characters, and reading time. A per-project target
with a progress bar is the single most-requested thing in comparable tools.

Store the target on \`projects\` (a new nullable integer column plus a
migration), edit it from the stats panel, and show progress. No AI involved."

open_issue "Add Draft2Digital to the royalty CSV importers" "area:royalties,help wanted" \
"\`lib/providers/royalties/\` has parsers for KDP, Apple, Kobo, and StreetLib,
each with a fixture under \`tests/fixtures/royalty-csvs/\` and a unit test.
Draft2Digital is the most common gap.

Follow the existing provider shape, add a real (anonymised) fixture, and a
test that covers the column layout and the currency handling."

open_issue "Document a Coolify deployment" "documentation,self-hosting,help wanted" \
"\`docs/self-hosting.md\` covers Docker Compose and a Next.js host. Coolify is
the most-asked-about self-hosting platform after plain Compose.

If you run it there, a walkthrough -- services, environment, the converter's
private networking -- would help the next person. Screenshots welcome."

open_issue "Run epubcheck against every genre template in CI" "good first issue,area:export" \
"\`tests/integration/convert.sh\` validates one EPUB built with the literary
template. A template with broken CSS could ship unnoticed.

Loop the conversion over every id in \`VALID_TEMPLATES\` and validate each
one. Keep the runtime reasonable -- it is a weekly job as well as a per-PR one."

open_issue "Add a keyboard shortcuts help dialog" "good first issue,area:editor" \
"The editor has shortcuts and no way to discover them. Add a dialog on \`?\`
(and a menu entry) listing them, built from a single source of truth so the
list cannot drift from the bindings.

Use the existing dialog component in \`components/ui/\` -- shadcn on Base UI,
never Radix. Strings in both locale files."

open_issue "Add an \"export as Markdown\" option" "enhancement,area:export,help wanted" \
"EPUB and PDF are the retail formats, but writers moving between tools ask for
Markdown -- it is the interchange format for novelWriter, Zettlr, and Obsidian.

The manuscript is already structured JSON, so this needs no converter service
round-trip; it can be a route that serialises chapters directly. See
\`ROADMAP.md\` v0.6."

open_issue "Make the dashboard usable at 320px" "good first issue,area:editor" \
"The Kanban board and the library grid assume a wide viewport. Authors do read
their dashboards on phones.

Fix the layout down to 320px without adding a separate mobile component -- the
Tailwind breakpoints already in use should be enough. Include before/after
screenshots at 320, 768, and 1280."

open_issue "Write the first Playwright smoke test" "help wanted,area:editor" \
"There is no browser-level test. The valuable one is short: sign up, create a
project, upload the fixture at \`tests/fixtures/manuscripts/test-manuscript.docx\`,
and assert the chapters appear in the editor.

It should run against the Docker image on a schedule rather than on every PR --
see \`.github/workflows/\`. Setting up the harness is most of the work here."

open_issue "Add a third locale" "help wanted,area:i18n,enhancement" \
"The interface is English and Mexican Spanish at exact key parity, enforced by
a test. A third locale is mostly mechanical: copy \`messages/en.json\`,
translate, and add the locale to \`i18n/routing.ts\`.

Portuguese (Brazil) is the obvious next one for self-publishing authors. Please
open an issue to claim a language before starting -- these are large PRs and it
would be a shame to duplicate the work."

echo "==> Done."
echo "    Remaining manual steps: branch protection on main (require CI,"
echo "    squash merges), the repository description, topics, and the social"
echo "    preview image. See docs/maintaining.md."
