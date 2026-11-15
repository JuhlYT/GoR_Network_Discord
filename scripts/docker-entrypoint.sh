#!/bin/sh
set -eu
umask 077

# Railway mounts volumes as root. Prepare only this bot's known files, then drop root.
data_dir=${GOR_DATA_DIR:-/data}
if [ "$data_dir" != /data ]; then echo 'Container data directory must be /data.' >&2; exit 1; fi
if [ "$(id -u)" = 0 ]; then
  if [ -L "$data_dir" ]; then echo 'Data directory must not be a symbolic link.' >&2; exit 1; fi
  mkdir -p "$data_dir"
  chown bun:bun "$data_dir"
  chmod 700 "$data_dir"
  for name in support.sqlite support.sqlite-wal support.sqlite-shm; do
    if [ -L "$data_dir/$name" ]; then echo 'Database paths must not be symbolic links.' >&2; exit 1; fi
    if [ -f "$data_dir/$name" ]; then chown bun:bun "$data_dir/$name"; chmod 600 "$data_dir/$name"; fi
  done
  if [ -L "$data_dir/backups" ]; then echo 'Backup directory must not be a symbolic link.' >&2; exit 1; fi
  mkdir -p "$data_dir/backups"
  chown bun:bun "$data_dir/backups"
  chmod 700 "$data_dir/backups"
  find "$data_dir/backups" -maxdepth 1 -type f -name 'gor-*.sqlite' -exec chown bun:bun {} +
  exec gosu bun "$@"
fi
exec "$@"
