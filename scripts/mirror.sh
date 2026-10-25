#!/bin/sh
# Node keeps its own CA store; Forgejo's certificate is signed by the system's.
set -eu
cd "$(dirname "$0")/.."
exec node --use-system-ca scripts/mirror.mjs "$@"
