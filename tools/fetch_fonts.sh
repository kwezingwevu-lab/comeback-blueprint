#!/usr/bin/env bash
# Caches the app's real Google Fonts in qa/.fonts (git-ignored) so the audit walker's screenshots use the
# typography the phone sees. The browser in the cloud sandbox cannot reach Google Fonts; curl can.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p qa/.fonts
URL='https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
curl -sS -A "$UA" "$URL" -o qa/.fonts/fonts.css
grep -o 'https://fonts.gstatic.com[^)]*' qa/.fonts/fonts.css | sort -u | while read -r u; do
  f=$(echo "$u" | sed 's#https://fonts.gstatic.com/##; s#/#_#g'); curl -sS "$u" -o "qa/.fonts/$f"; done
echo "cached $(ls qa/.fonts | wc -l) files in qa/.fonts"
