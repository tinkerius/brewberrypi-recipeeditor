#!/usr/bin/env bash
# Copies the files this editor takes from the other BrewberryPi repositories and records their commits in
# upstream.json:
#   - tinkerius/brewberrypi-app: the recipe schema and the sample recipes (docs/specification/data/)
#   - tinkerius/brewberrypi:     the brand logo, favicons and font (brand/, site/fonts/)
# Don't edit the copies here; change them upstream and run this script again.
#
# Usage: scripts/sync-upstream.sh [--check] <brewberrypi-app checkout> <brewberrypi checkout>
#   --check  change nothing; fail if a copy differs from the checkout or a checkout is not at the
#            commit recorded in upstream.json (CI checks out both repositories at those commits).
set -euo pipefail

check=false
if [[ "${1:-}" == "--check" ]]; then
  check=true
  shift
fi
if [[ $# -ne 2 ]]; then
  echo "usage: $0 [--check] <brewberrypi-app checkout> <brewberrypi checkout>" >&2
  exit 2
fi
app=$1
brand=$2
root=$(cd "$(dirname "$0")/.." && pwd)

# source (relative to its checkout) -> destination (relative to this repository)
app_files=("docs/specification/data/recipe.schema.json:src/data/recipe.schema.json")
for f in "$app"/docs/specification/data/recipes/*.json; do
  app_files+=("docs/specification/data/recipes/$(basename "$f"):src/data/recipes/$(basename "$f")")
done
brand_files=(
  "brand/logo.svg:public/logo.svg"
  "brand/logo-dark.svg:public/logo-dark.svg"
  "brand/favicon.svg:public/favicon.svg"
  "brand/favicon.ico:public/favicon.ico"
  "brand/apple-touch-icon.png:public/apple-touch-icon.png"
  "site/fonts/zilla-slab-medium.woff2:public/fonts/zilla-slab-medium.woff2"
  "site/fonts/OFL.txt:public/fonts/OFL.txt"
)

failed=false

# copy_or_check <checkout> <src:dst>...
copy_or_check() {
  local checkout=$1
  shift
  local pair src dst
  for pair in "$@"; do
    src="$checkout/${pair%%:*}"
    dst="$root/${pair#*:}"
    if $check; then
      if ! cmp -s "$src" "$dst"; then
        echo "differs from upstream: ${pair#*:} (${pair%%:*})" >&2
        failed=true
      fi
    else
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
    fi
  done
}

copy_or_check "$app" "${app_files[@]}"
copy_or_check "$brand" "${brand_files[@]}"

# Sample recipes deleted upstream must go here too.
for f in "$root"/src/data/recipes/*.json; do
  if [[ ! -e "$app/docs/specification/data/recipes/$(basename "$f")" ]]; then
    if $check; then
      echo "not upstream any more: src/data/recipes/$(basename "$f")" >&2
      failed=true
    else
      rm "$f"
    fi
  fi
done

app_commit=$(git -C "$app" rev-parse HEAD)
brand_commit=$(git -C "$brand" rev-parse HEAD)
if $check; then
  recorded=$(cat "$root/upstream.json")
  for commit in "$app_commit" "$brand_commit"; do
    if [[ "$recorded" != *"\"$commit\""* ]]; then
      echo "checkout at $commit is not the commit recorded in upstream.json" >&2
      failed=true
    fi
  done
  if $failed; then
    echo "run scripts/sync-upstream.sh <app> <brand> and commit the result" >&2
    exit 1
  fi
  echo "upstream copies match"
else
  cat > "$root/upstream.json" <<JSON
{
  "brewberrypi-app": "$app_commit",
  "brewberrypi": "$brand_commit"
}
JSON
  echo "copied from brewberrypi-app $app_commit and brewberrypi $brand_commit"
fi
