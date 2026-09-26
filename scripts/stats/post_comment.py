"""Paperclip 이슈에 마크다운 댓글을 올린다. 사용: python3 post_comment.py <issueId> <파일|->

파일 자리에 `-` 를 주면 표준입력에서 본문을 읽는다.
"""
import json
import os
import sys
import urllib.request

API = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')


def post(issue_id, body):
    req = urllib.request.Request(
        API + '/api/issues/%s/comments' % issue_id,
        data=json.dumps({'body': body}).encode(),
        method='POST',
        headers={
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': RUN,
        },
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
    except urllib.error.HTTPError as exc:
        return {'error': exc.code, 'body': exc.read().decode()[:500]}


if __name__ == '__main__':
    text = sys.stdin.read() if sys.argv[2] == '-' else open(sys.argv[2], encoding='utf-8').read()
    res = post(sys.argv[1], text)
    print(json.dumps(res, ensure_ascii=False)[:300])
