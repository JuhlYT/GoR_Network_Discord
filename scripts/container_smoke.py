#!/usr/bin/env python3
"""Start the production image with a mocked Discord gateway, including its real entrypoint."""
import argparse
import json
from pathlib import Path
import posixpath
import re
import socket
import subprocess
import time
import uuid


def docker(*args):
    return subprocess.run(['docker', *args], check=True, text=True, capture_output=True).stdout.strip()


def wait_ready(port):
    deadline = time.monotonic() + 25
    while True:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=1) as connection:
                connection.sendall(b'GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')
                raw = b''
                while part := connection.recv(4096):
                    raw += part
            headers, body = raw.split(b'\r\n\r\n', 1)
            if int(headers.split(b' ')[1]) == 200:
                return json.loads(body)
        except (OSError, ValueError):
            pass
        if time.monotonic() > deadline:
            raise AssertionError('Production container did not become ready')
        time.sleep(.1)


def check_image(image, port, mount_path=None, data_dir='/data'):
    name = 'gor-startup-' + uuid.uuid4().hex[:12]
    fixtures = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
    command = ['run', '--detach', '--name', name, '--publish', f'127.0.0.1:{port}:8080',
               '--env', 'TOKEN=fixture-not-a-real-discord-token', '--env', 'RAILWAY_ENVIRONMENT_ID=startup-fixture',
               '--env', f'GOR_DATA_DIR={data_dir}',
               '--mount', f'type=bind,source={fixtures},target=/app/tests/fixtures,readonly']
    if mount_path:
        command += ['--env', f'RAILWAY_VOLUME_MOUNT_PATH={mount_path}',
                    '--mount', f'type=volume,target={posixpath.normpath(mount_path)}']
    command += [image, 'bun', 'run', 'tests/fixtures/startup.ts']
    try:
        docker(*command)
        health = wait_ready(port)
        expected = 'persistent' if mount_path else 'temporary'
        if health['storage'] != expected:
            raise AssertionError('Container used an unexpected data mode')
        directory = posixpath.normpath((mount_path or data_dir).strip())
        docker('exec', name, 'test', '-f', directory + '/support.sqlite')
        status = docker('exec', name, 'cat', '/proc/1/status')
        uid = re.search(r'^Uid:\s+(\d+)', status, flags=re.MULTILINE)
        if not uid or int(uid.group(1)) == 0:
            raise AssertionError('Bot did not drop root privileges')
        logs = docker('logs', name)
        if 'discord_ready' not in logs or 'fixture-not-a-real-discord-token' in logs:
            raise AssertionError('Container startup or credential handling failed')
        docker('stop', '--time', '15', name)
        if docker('inspect', '--format', '{{.State.ExitCode}}', name) != '0':
            raise AssertionError('Container did not stop cleanly')
        # Exercise the same entrypoint again with an existing database and backups.
        docker('start', name)
        restarted = wait_ready(port)
        if restarted['storage'] != expected:
            raise AssertionError('Storage mode changed after restart')
        docker('exec', name, 'test', '-f', directory + '/support.sqlite')
        docker('stop', '--time', '15', name)
        if docker('inspect', '--format', '{{.State.ExitCode}}', name) != '0':
            raise AssertionError('Restarted container did not stop cleanly')
        return {'storage': expected, 'directory': directory, 'health': 200,
                'restart': 'passed', 'process_uid': int(uid.group(1)), 'discord': 'mocked'}
    finally:
        subprocess.run(['docker', 'rm', '--force', '--volumes', name], capture_output=True)


def check_rejected_paths(image):
    for directory in ('/', '/app', '/proc/gor-data', 'relative/data', '/data/../app'):
        result = subprocess.run(['docker', 'run', '--rm', '--env', f'GOR_DATA_DIR={directory}', image, 'true'],
                                text=True, capture_output=True)
        if result.returncode != 1 or 'Data directory' not in result.stderr:
            raise AssertionError('Unsafe data directory was not rejected before permission changes')
    result = subprocess.run(['docker', 'run', '--rm', '--entrypoint', 'sh', image, '-c',
                             'mkdir /tmp/gor-target && ln -s /tmp/gor-target /tmp/gor-link '
                             '&& GOR_DATA_DIR=/tmp/gor-link/child /usr/local/bin/gor-entrypoint true'],
                            text=True, capture_output=True)
    if result.returncode != 1 or 'symbolic links' not in result.stderr:
        raise AssertionError('Symlink parent was not rejected before permission changes')
    return 6


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default='gor-network-check')
    parser.add_argument('--port', type=int, default=38597)
    args = parser.parse_args()
    results = [check_image(args.image, args.port)]
    for mount_path in ('/data', '/app/data', '/app/betrieb', '/gor-storage', '/var/lib/gor network/'):
        results.append(check_image(args.image, args.port, mount_path, '/stale-data-path'))
    results.append(check_image(args.image, args.port, data_dir='/custom-gor-data/nested/store/'))
    rejected = check_rejected_paths(args.image)
    print(json.dumps({'container_startup': 'passed', 'checks': results, 'rejected_unsafe_paths': rejected}))


if __name__ == '__main__':
    main()
