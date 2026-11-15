#!/usr/bin/env python3
"""Test fail-fast startup and readiness with an explicitly mocked Discord gateway."""
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


def run_scenario(root, bun, port, scenario):
    with tempfile.TemporaryDirectory(prefix='gor-smoke-') as data:
        env = os.environ.copy()
        for key in ('GOR_DISCORD_BOT_TOKEN', 'DISCORD_TOKEN', 'DISCORD_BOT_TOKEN', 'BOT_TOKEN', 'TOKEN',
                    'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_VOLUME_MOUNT_PATH', 'GOR_FIXTURE_ADMIN',
                    'GOR_FIXTURE_SYNC_ERROR', 'GOR_FIXTURE_WRONG_APP', 'GOR_FIXTURE_INVALID_TOKEN', 'GOR_FIXTURE_HANG', 'GOR_FIXTURE_FLOW',
                    'GOR_AUTO_SETUP', 'GOR_FIXTURE_SETUP'):
            env.pop(key, None)
        env.update(PORT=str(port), GOR_DATA_DIR=data, GOR_SUPPORT_ENABLED='false', GOR_AUTO_SETUP='false')
        mocked = scenario != 'missing-token'
        if mocked:
            env.update(RAILWAY_ENVIRONMENT_ID='startup-fixture', TOKEN='fixture-not-a-real-discord-token')
            if scenario != 'railway-no-volume':
                env['RAILWAY_VOLUME_MOUNT_PATH'] = data
            if scenario == 'railway-admin':
                env['GOR_FIXTURE_ADMIN'] = 'true'
            if scenario == 'command-sync-failure':
                env['GOR_FIXTURE_SYNC_ERROR'] = 'true'
            if scenario == 'wrong-application':
                env['GOR_FIXTURE_WRONG_APP'] = 'true'
            if scenario == 'invalid-token':
                env['GOR_FIXTURE_INVALID_TOKEN'] = 'true'
            if scenario == 'connection-timeout':
                env['GOR_FIXTURE_HANG'] = 'true'
            if scenario.startswith('flow-'):
                env['GOR_FIXTURE_FLOW'] = scenario.removeprefix('flow-')
            if scenario == 'flow-project':
                env['GOR_SUPPORT_ENABLED'] = 'true'
            if scenario in ('automatic-setup', 'setup-failure'):
                env.update(GOR_AUTO_SETUP='true', GOR_FIXTURE_SETUP=scenario)
        entry = 'tests/fixtures/startup.ts' if mocked else 'gor_network.ts'
        process = subprocess.Popen([bun, 'run', entry], cwd=root, env=env,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        results = []
        try:
            rejected = {'missing-token': 'configuration_token_missing', 'wrong-application': 'wrong_application',
                        'invalid-token': 'token_invalid', 'connection-timeout': 'startup_timeout'}
            if scenario in rejected:
                stdout, stderr = process.communicate(timeout=10)
                logs = stdout + stderr
                if process.returncode != 1 or rejected[scenario] not in logs:
                    raise AssertionError('Startup failure was not reported and stopped: ' + scenario)
                if 'discord_ready' in logs:
                    raise AssertionError('A failed startup was reported as ready')
                if 'fixture-not-a-real-discord-token' in logs or 'private-fixture-body' in logs:
                    raise AssertionError('Private credential or error body leaked')
                return {'scenario': scenario, 'discord': 'mocked' if mocked else 'not_contacted',
                        'exit': process.returncode, 'diagnostic': rejected[scenario]}
            deadline = time.monotonic() + 15
            while True:
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=.2):
                        break
                except OSError:
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError('Health listener did not start')
                    time.sleep(.1)
            for route, wanted in (('/live', 200), ('/health', 200), ('/support.sqlite', 404)):
                deadline = time.monotonic() + 10
                while True:
                    with socket.create_connection(('127.0.0.1', port), timeout=3) as connection:
                        connection.sendall(('GET ' + route + ' HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n').encode())
                        response = b''
                        while part := connection.recv(4096):
                            response += part
                    headers, body = response.split(b'\r\n\r\n', 1)
                    status = int(headers.split(b' ')[1])
                    setup_ready = scenario not in ('automatic-setup', 'setup-failure') or json.loads(body).get('setup') == ('ready' if scenario == 'automatic-setup' else 'attention')
                    if (status == wanted and setup_ready) or route != '/health' or time.monotonic() > deadline:
                        break
                    time.sleep(.05)
                if status != wanted:
                    raise AssertionError(f'{route}: expected {wanted}, got {status}')
                if route == '/health':
                    health = json.loads(body)
                    if health['status'] != 'ready':
                        raise AssertionError('A connected fixture was not ready')
                    if scenario == 'railway-no-volume' and health['storage'] != 'temporary':
                        raise AssertionError('Missing volume was reported as persistent')
                results.append({'route': route, 'status': status})
            time.sleep(.1)
            process.send_signal(signal.SIGTERM)
            stdout, stderr = process.communicate(timeout=10)
            logs = stdout + stderr
            if process.returncode != 0:
                raise AssertionError('Process did not shut down cleanly')
            if 'discord_ready' not in logs:
                raise AssertionError('Expected startup state was not reached')
            if mocked and 'fixture_presence_online' not in logs:
                raise AssertionError('Connected fixture did not set its online presence')
            if scenario == 'railway-admin' and 'administrator_permission_detected' not in logs:
                raise AssertionError('Administrator warning was not reported')
            if scenario == 'command-sync-failure' and 'commands_registration_failed_retrying' not in logs:
                raise AssertionError('Failed command registration was not isolated from the connection')
            if scenario.startswith('flow-') and 'fixture_flow_passed:' + scenario.removeprefix('flow-') not in logs:
                raise AssertionError('The actual interaction handler did not confirm the community flow: ' + scenario)
            if scenario in ('automatic-setup', 'setup-failure') and 'fixture_automatic_setup_called' not in logs:
                raise AssertionError('Ready event did not trigger the automatic setup runner')
            if 'fixture-not-a-real-discord-token' in logs or 'private-fixture-body' in logs:
                raise AssertionError('Private credential or error body leaked')
            backups = list(Path(data).glob('backups/*.sqlite'))
            if not backups:
                raise AssertionError('Shutdown did not create a consistent backup')
            results.append({'sigterm': 'clean_exit', 'backup': 'created'})
            return {'scenario': scenario, 'discord': 'mocked' if mocked else 'not_contacted', 'checks': results}
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bun', default=shutil.which('bun'))
    parser.add_argument('--port', type=int, default=34693)
    args = parser.parse_args()
    if not args.bun:
        parser.error('Bun is required; pass --bun /absolute/path/to/bun')
    root = Path(__file__).resolve().parent.parent
    scenarios = ['missing-token', 'invalid-token', 'connection-timeout', 'railway-no-volume', 'railway-admin',
                 'command-sync-failure', 'wrong-application']
    scenarios += ['flow-' + flow for flow in ('start', 'public-guide', 'private-guide', 'private-roles', 'own', 'team', 'phase', 'project', 'setup', 'setupstatus')]
    scenarios += ['automatic-setup', 'setup-failure']
    results = [run_scenario(root, args.bun, args.port, scenario) for scenario in scenarios]
    print(json.dumps({'smoke_test': 'passed', 'scenarios': results}))


if __name__ == '__main__':
    main()
