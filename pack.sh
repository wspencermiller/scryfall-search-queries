#!/usr/bin/env bash
# Package the extension for deployment (Chrome Web Store, Brave, or sideload).
# Output: scryfall-saved-queries.zip in the project root.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/scryfall-saved-queries.zip"
cd "$ROOT"

# Remove old zip if present
rm -f "$OUT"

# Zip only the files needed to run the extension (no .git, README, or this script)
zip -r "$OUT" \
  manifest.json \
  popup.html \
  popup.js \
  popup.css \
  manage.html \
  manage.js \
  manage.css \
  content.js \
  icons/

echo "Created: $OUT"
echo "Upload this zip to the Chrome Web Store Developer Dashboard, or distribute it for users to install (they can load the unpacked folder after unzipping)."
