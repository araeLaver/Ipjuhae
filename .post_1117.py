import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
iid = '8ea15bc8-a011-4aaa-9ab8-efe9989bd723'
h = {
    'Authorization': 'Bearer ' + k,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}

body = open('.dow1117-qa.md', encoding='utf-8').read()
payload = json.dumps(dict(body=body)).encode()
req = urllib.request.Request(u + '/api/issues/' + iid + '/comments', data=payload, headers=h)
print('comment', json.load(urllib.request.urlopen(req)).get('id'))

patch = json.dumps(dict(
    status='todo',
    assigneeAgentId='552e7131-10bd-4f0c-a631-ae1fbbdf89ba',
    comment='QA 재검증 결과 후속 2건(회귀 1 + 경미 1)이 남아 빌더에게 되돌립니다. 보고된 원 결함 2건은 합격입니다.',
)).encode()
req2 = urllib.request.Request(u + '/api/issues/' + iid, data=patch, headers=h, method='PATCH')
d = json.load(urllib.request.urlopen(req2))
print('status', d.get('status'), 'assignee', d.get('assigneeAgentId'))
