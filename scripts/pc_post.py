"""Post a Paperclip comment (or arbitrary JSON POST) with the body read from a file.

Usage:
  python3 scripts/pc_post.py comment <issueId> <bodyFile>
  python3 scripts/pc_post.py approval <companyId> <payloadJsonFile>
"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pc import call

mode = sys.argv[1]

if mode == 'comment':
    issue_id, body_file = sys.argv[2], sys.argv[3]
    with open(body_file, encoding='utf-8') as f:
        body = f.read()
    print(json.dumps(call('POST', '/api/issues/%s/comments' % issue_id, {'body': body}),
                     ensure_ascii=False)[:2000])
elif mode == 'approval':
    company_id, payload_file = sys.argv[2], sys.argv[3]
    with open(payload_file, encoding='utf-8') as f:
        payload = json.load(f)
    print(json.dumps(call('POST', '/api/companies/%s/approvals' % company_id, payload),
                     ensure_ascii=False)[:3000])
else:
    raise SystemExit('unknown mode: %s' % mode)
