"""Paperclip 이슈 문서 업로드(생성·갱신).

사용: python3 scripts/stats/put_doc.py <issueId> <docKey> <제목> <본문파일>

기존 문서가 있으면 latestRevisionId를 조회해 baseRevisionId로 넘긴다.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')


def call(path, method='GET', body=None, quiet=False):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={'Authorization': 'Bearer ' + KEY,
                 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': RUN})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as exc:
        if not quiet:
            print('HTTP', exc.code, exc.read().decode()[:600])
        raise


def main(issue_id, doc_key, title, path):
    body = open(path, encoding='utf-8').read()
    base_rev = None
    try:
        base_rev = call('/api/issues/%s/documents/%s' % (issue_id, doc_key),
                        quiet=True).get('latestRevisionId')
    except urllib.error.HTTPError as exc:
        if exc.code != 404:  # 404는 신규 생성이므로 정상 경로
            raise
    res = call('/api/issues/%s/documents/%s' % (issue_id, doc_key), 'PUT', {
        'title': title,
        'format': 'markdown',
        'body': body,
        'baseRevisionId': base_rev,
    })
    print('doc ok', doc_key, res.get('latestRevisionId'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
