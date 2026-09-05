#!/usr/bin/env bash
set -euo pipefail

# Keep this entrypoint usable from any working directory.
exec node "$(dirname "$0")/verify-images.mjs" "$@"
