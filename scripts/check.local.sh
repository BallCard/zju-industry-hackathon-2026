# CI/self-check for the currently shippable standalone app; no secrets or private KB required for syntax validation.
set -euo pipefail
app="$(dirname "$0")/../apps/pc-studio"
if [ ! -d "$app" ]; then echo '(PC Studio module not present)'; exit 0; fi
if ! command -v node >/dev/null 2>&1; then echo '(Node.js not available; skipped PC Studio smoke checks)'; exit 0; fi
( cd "$app" && npm run check && npm test )
