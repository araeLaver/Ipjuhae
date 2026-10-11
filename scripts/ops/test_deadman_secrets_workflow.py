"""운영 연결 없이 workflow의 검증 및 stdin staging을 재현합니다."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

WORKFLOW = Path(sys.argv.pop(1))
BLOCKS = []
for chunk in WORKFLOW.read_text().split('        run: |\n')[1:]:
    lines = []
    for line in chunk.splitlines():
        if line and not line.startswith('          '):
            break
        lines.append(line[10:])
    BLOCKS.append('\n'.join(lines) + '\n')

class WorkflowQA(unittest.TestCase):
    def execute(self, changes=None):
        with tempfile.TemporaryDirectory() as tmp:
            capture = Path(tmp) / 'capture.json'
            mock = Path(tmp) / 'flyctl'
            mock.write_text('#!/usr/bin/env python3\nimport json,os,sys\nfrom pathlib import Path\nPath(os.environ["QA_CAPTURE"]).write_text(json.dumps({"args":sys.argv[1:],"stdin":sys.stdin.read()}))\n')
            mock.chmod(0o755)
            env = {'PATH': tmp + ':' + os.environ['PATH'], 'FLY_API_TOKEN': 'qa-fake-fly',
                   'OPS_HEARTBEAT_SECRET': 'q'*32, 'OPS_ALERT_EMAIL': 'qa@example.com',
                   'QA_CAPTURE': str(capture), **(changes or {})}
            result = subprocess.run(['bash', '-c', BLOCKS[0]], env=env, capture_output=True, text=True)
            if result.returncode == 0:
                subprocess.run(['bash', '-c', BLOCKS[1]], env=env, capture_output=True, check=True)
            data = json.loads(capture.read_text()) if capture.exists() else None
            if env['FLY_API_TOKEN']:
                self.assertNotIn(env['FLY_API_TOKEN'], result.stdout + result.stderr)
            self.assertNotIn('q'*32, result.stdout + result.stderr)
            return result.returncode, data

    def test_valid_staging(self):
        code, data = self.execute()
        self.assertEqual(code, 0)
        self.assertEqual(data['args'], ['secrets', 'import', '--stage', '--app', 'ipjuhae-production'])
        self.assertEqual(data['stdin'], 'OPS_HEARTBEAT_SECRET=' + 'q'*32 + '\nOPS_ALERT_EMAIL=qa@example.com\n')

    def test_valid_bare_addresses(self):
        for email in ['qa+alerts@example.com', 'qa.ops@sub.example.com']:
            with self.subTest(email=email):
                code, data = self.execute({'OPS_ALERT_EMAIL': email})
                self.assertEqual(code, 0)
                self.assertIn('OPS_ALERT_EMAIL=' + email + '\n', data['stdin'])

    def test_invalid_settings_stop_staging(self):
        cases = [({'FLY_API_TOKEN': ''}), ({'OPS_HEARTBEAT_SECRET': ''}),
                 ({'OPS_HEARTBEAT_SECRET': 'q'*31}), ({'OPS_HEARTBEAT_SECRET': 'q'*32+'\n'}),
                 ({'OPS_HEARTBEAT_SECRET': 'q'*32+' '}), ({'OPS_ALERT_EMAIL': 'qa@example.com\n'}),
                 ({'OPS_ALERT_EMAIL': 'qa@example.com,other@example.com'})]
        for change in cases:
            with self.subTest(change=change):
                code, data = self.execute(change)
                self.assertNotEqual(code, 0)
                self.assertIsNone(data)

    def test_malformed_addresses_stop_staging(self):
        for email in ['qa,other@example.com', 'qa;other@example.com', '<qa@example.com>',
                      '.qa@example.com', 'qa..other@example.com', 'qa@-example.com',
                      'qa@example-.com', 'qa@example..com']:
            with self.subTest(email=email):
                code, data = self.execute({'OPS_ALERT_EMAIL': email})
                self.assertNotEqual(code, 0, '잘못된 주소가 staging에 전달됨')
                self.assertIsNone(data)

if __name__ == '__main__':
    unittest.main()
