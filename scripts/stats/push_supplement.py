"""DOW-1234 supplement 문서를 저장소 사본으로 갱신한다."""
import json
import os
import urllib.request

API = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')
ISSUE = '74a9ab21-61e8-4773-a0dc-86e46db669b3'
DOC = 'supplement'
SRC = '/Volumes/WorkDrive/Develop/02_Ipjuhae/docs/business-development/20260926_gvalley_cmo_supplement.md'


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': RUN,
    })
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
    except urllib.error.HTTPError as exc:
        return {'error': exc.code, 'body': exc.read().decode()[:500]}


if __name__ == '__main__':
    current = call('GET', '/api/issues/%s/documents/%s' % (ISSUE, DOC))
    base = current.get('latestRevisionId')
    print('current keys:', list(current.keys())[:12], 'base:', base)
    body = open(SRC, encoding='utf-8').read()
    res = call('PUT', '/api/issues/%s/documents/%s' % (ISSUE, DOC), {
        'title': '본문·통계·공식 서식 보완 (2차 — 통계 4건 전부 확정)',
        'format': 'markdown',
        'body': body,
        'baseRevisionId': base,
    })
    print(json.dumps(res, ensure_ascii=False)[:600])
