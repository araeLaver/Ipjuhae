import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
ME = os.environ['PAPERCLIP_AGENT_ID']


def g(p):
    r = urllib.request.Request(u + p, headers=dict(Authorization='Bearer ' + k))
    return json.load(urllib.request.urlopen(r))


ids = [
    ('DOW-730', 'f3b8b4f5-75d9-4d09-8986-92aac3ac1bf4'),
    ('DOW-362', 'be3c950a-de4f-4a21-aeb8-329bbddf5947'),
    ('DOW-781', 'ef7c30be-aa61-4c80-a5e2-56a2382fe6d6'),
    ('DOW-448', '930f623f-2900-4ad6-916a-bc3f551b6818'),
]

for ident, iid in ids:
    cs = g('/api/issues/' + iid + '/comments')
    cs = cs if isinstance(cs, list) else cs.get('comments', [])
    print('=====', ident, 'comments:', len(cs))
    for c in cs[:2]:
        who = 'ME' if c.get('authorAgentId') == ME else (c.get('authorAgentId') or c.get('authorUserId'))
        print(' -', c.get('createdAt'), who)
        print('   ', (c.get('body') or '').replace('\n', ' ')[:260])

# DOW-1123 상태
try:
    res = g('/api/companies/' + os.environ['PAPERCLIP_COMPANY_ID'] + '/issues?q=DOW-1123')
    items = res if isinstance(res, list) else res.get('issues', [])
    for i in items[:3]:
        print('DOW-1123?', i.get('identifier'), i.get('status'), i.get('assigneeAgentId'), i.get('title')[:50])
except Exception as e:
    print('search err', e)
