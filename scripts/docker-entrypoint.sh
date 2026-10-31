#!/bin/sh
set -eu

# Docker creates a missing bind-mount directory as root. Prepare only the
# backup directory, then run the server as the unprivileged node user.
if [ "$(id -u)" = '0' ]; then
  mkdir -p "$BACKUPS_DIR" && chown node:node "$BACKUPS_DIR" || \
    echo 'Cannot prepare backup directory; the server will log backup failures.' >&2
  exec gosu node "$@"
fi
exec "$@"
