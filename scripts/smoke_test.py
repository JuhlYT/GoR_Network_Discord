#!/usr/bin/env python3
"""Run a real local process without Discord credentials; verify HTTP and graceful shutdown."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bun', default=shutil.which('bun'))
    parser.add_argument('--port', type=int, default=34693)
    args = parser.parse_args()
    if not args.bun:
        parser.error('Bun is required; pass --bun /absolute/path/to/bun')
    root = Path(__file__).resolve().parent.parent
    with tempfile.TemporaryDirectory(prefix='gor-smoke-') as data:
        env = os.environ.copy()
        for key in ('GOR_DISCORD_BOT_TOKEN', 'DISCORD_TOKEN', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_VOLUME_MOUNT_PATH'):
            env.pop(key, None)
        env.update(PORT=str(args.port), GOR_DATA_DIR=data, GOR_SUPPORT_ENABLED='false')
        process = subprocess.Popen([args.bun, 'run', 'gor_network.ts'], cwd=root, env=env,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        results = []
        try:
            deadline = time.monotonic() + 15
            while True:
                try:
                    with socket.create_connection(('127.0.0.1', args.port), timeout=.2):
                        break
                except OSError:
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError('Health listener did not start')
                    time.sleep(.1)
            for route, wanted in (('/live', 200), ('/health', 503), ('/support.sqlite', 404)):
                with socket.create_connection(('127.0.0.1', args.port), timeout=3) as connection:
                    connection.sendall(('GET ' + route + ' HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n').encode())
                    response = b''
                    while part := connection.recv(4096):
                        response += part
                headers, body = response.split(b'\r\n\r\n', 1)
                status = int(headers.split(b' ')[1])
                if status != wanted:
                    raise AssertionError(f'{route}: expected {wanted}, got {status}')
                if route == '/health' and json.loads(body)['status'] != 'token_missing':
                    raise AssertionError('Missing credential was reported as ready')
                results.append({'route': route, 'status': status})
            process.send_signal(signal.SIGTERM)
            stdout, _ = process.communicate(timeout=10)
            if process.returncode != 0 or 'configuration_token_missing' not in stdout:
                raise AssertionError('Process did not shut down cleanly')
            backups = list(Path(data).glob('backups/*.sqlite'))
            if not backups:
                raise AssertionError('Shutdown did not create a consistent backup')
            results.append({'sigterm': 'clean_exit', 'backup': 'created'})
            print(json.dumps({'smoke_test': 'passed', 'checks': results}))
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


if __name__ == '__main__':
    main()
