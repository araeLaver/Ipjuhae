"""Paperclip 승인 요청을 생성한다.

사용: python3 create_approval.py <type> <제목> <본문파일> [연결이슈id ...]
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')
COMPANY = os.environ['PAPERCLIP_COMPANY_ID']
AGENT = os.environ['PAPERCLIP_AGENT_ID']

if __name__ == '__main__':
    kind, title, body_path = sys.argv[1], sys.argv[2], sys.argv[3]
    issues = sys.argv[4:]
    body = sys.stdin.read() if body_path == '-' else open(body_path).read()
    payload = {
        'type': kind,
        'title': title,
        'summary': body,
        'requestedByAgentId': AGENT,
        'issueIds': issues,
        'payload': {'summary': body, 'issueIds': issues},
    }
    req = urllib.request.Request(
        API + '/api/companies/%s/approvals' % COMPANY,
        data=json.dumps(payload).encode(),
        method='POST',
        headers={
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': RUN,
        },
    )
    try:
        print(json.dumps(json.loads(urllib.request.urlopen(req).read().decode()), ensure_ascii=False)[:800])
    except urllib.error.HTTPError as exc:
        print(exc.code, exc.read().decode()[:1200])
