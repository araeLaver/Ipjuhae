"""DOW-1234 분량 예산 문서 업로드 및 코멘트 게시."""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')


def call(path, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={'Authorization': 'Bearer ' + KEY,
                 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': RUN})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:600])
        raise


ISSUE = '74a9ab21-61e8-4773-a0dc-86e46db669b3'
KEY_DOC = 'page-budget'
body = open('docs/business-development/20260926_gvalley_form2_page_budget.md',
            encoding='utf-8').read()

base_rev = None
try:
    cur = call('/api/issues/%s/documents/%s' % (ISSUE, KEY_DOC))
    base_rev = cur.get('latestRevisionId')
except urllib.error.HTTPError:
    pass

res = call('/api/issues/%s/documents/%s' % (ISSUE, KEY_DOC), 'PUT', {
    'title': '서식2 분량 미달 판정과 증량 계획',
    'format': 'markdown',
    'body': body,
    'baseRevisionId': base_rev,
})
print('doc ok', res.get('latestRevisionId'))
