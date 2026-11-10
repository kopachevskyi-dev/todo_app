#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

service=${1:?usage: containers.sh verify|e2e|smoke [file-or-entry]}
shift
case "$service" in
  verify)
    docker compose build app verify
    exec docker compose run --rm --no-deps verify
    ;;
  e2e)
    docker compose build e2e
    exec docker compose run --rm --no-deps e2e pnpm test:e2e:built "$@"
    ;;
  smoke)
    docker compose build app smoke
    exec docker compose run --rm --no-deps smoke node scripts/smoke-container.mjs "$@"
    ;;
  *)
    echo "Unknown container check: $service" >&2
    exit 2
    ;;
esac
