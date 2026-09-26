"""시장 통계 출처 대장 저장소 사본을 Paperclip 이슈 문서로 올린다.

사용: python3 push_ledger.py <issueId> <documentKey> <파일경로>
저장소 사본을 정본으로 보고, 문서 안의 티켓 id는 Paperclip 내부 링크로 바꿔 올린다.
"""
import json
import os
import re
import sys
import urllib.request

API = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')

REPO_NOTE = 'Paperclip 정본: `/DOW/issues/DOW-1154#document-market-statistics` (이 파일은 저장소 사본이다).'
DOC_NOTE = '저장소 사본: `docs/business-development/20260926_gvalley_market_statistics_ledger.md`'


def to_doc_body(text):
    text = text.replace(REPO_NOTE, DOC_NOTE)
    text = re.sub(r'(?<![\[\/])(DOW-\d+)(?![\]\)\d])', r'[\1](/DOW/issues/\1)', text)
    text = text.replace(
        '확정값을 신청 패키지 4.1',
        '확정값을 [신청 패키지](/DOW/issues/DOW-1154#document-application-package) 4.1',
    )
    return text


def request(path, method='GET', payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'}
    if RUN:
        headers['X-Paperclip-Run-Id'] = RUN
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    return json.loads(urllib.request.urlopen(req).read().decode())


if __name__ == '__main__':
    issue_id, doc_key, path = sys.argv[1], sys.argv[2], sys.argv[3]
    title = sys.argv[4] if len(sys.argv) > 4 else None
    body = to_doc_body(open(path).read())
    doc_path = '/api/issues/%s/documents/%s' % (issue_id, doc_key)
    try:
        base = request(doc_path).get('latestRevisionId')
    except urllib.error.HTTPError:
        base = None
    res = request(doc_path, 'PUT', {
        'title': title or '문서',
        'format': 'markdown',
        'body': body,
        'baseRevisionId': base,
    })
    print(res.get('latestRevisionNumber'), res.get('latestRevisionId'))
