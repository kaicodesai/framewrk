#!/usr/bin/env bash
# Builds the Gumroad-ready zip from this directory's contents.
# Run from anywhere; output lands next to this script as agent-ops-starter-kit.zip.
set -euo pipefail
cd "$(dirname "$0")"
rm -f agent-ops-starter-kit.zip
zip -r agent-ops-starter-kit.zip \
  README.md LICENSE.md SALES_PAGE.md \
  skills agents hooks settings \
  -x '*.DS_Store'
echo "Built agent-ops-starter-kit.zip"
