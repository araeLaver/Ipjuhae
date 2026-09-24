import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']

body = {
    'status': 'in_progress',
    'comment': '커밋·push 한 건만 남았습니다. 상태를 in_progress 로 되돌립니다 — 미커밋 워킹트리는 완료로 보지 않습니다. 커밋 해시 보고 후 다시 in_review 로 올리십시오.',
}
req = urllib.request.Request(
    u + '/api/issues/df0f2697-71b2-4b7b-b1f9-57eea0efa752',
    data=json.dumps(body).encode(),
    method='PATCH',
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': rid,
    },
)
try:
    r = json.load(urllib.request.urlopen(req))
    print('ok', r.get('status'), r.get('assigneeAgentId'))
except Exception as e:
    print('ERR', e, getattr(e, 'read', lambda: b'')()[:400])
