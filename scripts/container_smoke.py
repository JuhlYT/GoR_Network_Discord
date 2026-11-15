#!/usr/bin/env python3
"""Start the production image with a mocked Discord gateway, including its real entrypoint."""
import argparse
import json
from pathlib import Path
import re
import socket
import subprocess
import time
import uuid


def docker(*args):
    return subprocess.run(['docker', *args], check=True, text=True, capture_output=True).stdout.strip()


def check_image(image, port, persistent):
    name = 'gor-startup-' + uuid.uuid4().hex[:12]
    fixtures = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures'
    command = ['run', '--detach', '--name', name, '--publish', f'127.0.0.1:{port}:8080',
               '--env', 'TOKEN=fixture-not-a-real-discord-token', '--env', 'RAILWAY_ENVIRONMENT_ID=startup-fixture',
               '--mount', f'type=bind,source={fixtures},target=/app/tests/fixtures,readonly']
    if persistent:
        command += ['--env', 'RAILWAY_VOLUME_MOUNT_PATH=/data', '--mount', 'type=volume,target=/data']
    command += [image, 'bun', 'run', 'tests/fixtures/startup.ts']
    try:
        docker(*command)
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
                    health = json.loads(body)
                    break
            except (OSError, ValueError):
                pass
            if time.monotonic() > deadline:
                raise AssertionError('Production container did not become ready')
            time.sleep(.1)
        expected = 'persistent' if persistent else 'temporary'
        if health['storage'] != expected:
            raise AssertionError('Container used an unexpected data mode')
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
        return {'storage': expected, 'health': 200, 'process_uid': int(uid.group(1)), 'discord': 'mocked'}
    finally:
        subprocess.run(['docker', 'rm', '--force', '--volumes', name], capture_output=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default='gor-network-check')
    parser.add_argument('--port', type=int, default=38597)
    args = parser.parse_args()
    results = [check_image(args.image, args.port, persistent) for persistent in (False, True)]
    print(json.dumps({'container_startup': 'passed', 'checks': results}))


if __name__ == '__main__':
    main()
