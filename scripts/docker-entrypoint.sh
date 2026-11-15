#!/bin/sh
set -eu
umask 077

# Railway allows a custom mount path. Resolve it before preparing permissions;
# never change ownership of application code, system directories or symlink targets.
data_dir=$(bun -e '
  const { join } = require("node:path");
  const { lstatSync } = require("node:fs");
  const { storageLocation } = await import("./storage_path.ts");
  const fail = message => { console.error(message); process.exit(1); };
  const { directory } = storageLocation(process.env, process.cwd(), "/data");
  const system = ["/bin", "/sbin", "/lib", "/lib64", "/usr", "/etc", "/dev", "/proc", "/sys", "/run"];
  const roots = ["/", "/app", "/var", "/var/lib", "/tmp", "/home", "/root", "/opt", "/mnt", "/media"];
  if (roots.includes(directory) || directory === process.cwd()
      || system.some(root => directory === root || directory.startsWith(root + "/"))
      || directory === "/app/node_modules" || directory.startsWith("/app/node_modules/"))
    fail("Data directory must be a dedicated storage directory, not an application or system directory.");
  let parent = "/";
  for (const segment of directory.split("/").filter(Boolean)) {
    parent = join(parent, segment);
    try {
      const stat = lstatSync(parent);
      if (stat.isSymbolicLink()) fail("Data directory and its parents must not be symbolic links.");
      if (!stat.isDirectory()) fail("Data directory path must contain directories only.");
    } catch (error) {
      if (error.code === "ENOENT") break;
      fail("Data directory could not be inspected. Check its access permissions.");
    }
  }
  console.log(directory);
')
export GOR_DATA_DIR="$data_dir"
if [ "$(id -u)" = 0 ]; then
  if [ -L "$data_dir" ]; then echo 'Data directory must not be a symbolic link.' >&2; exit 1; fi
  # Newly created parent directories must be traversable after dropping root.
  # The actual data directory is restricted before the bot can write any data.
  (umask 022; mkdir -p "$data_dir")
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
