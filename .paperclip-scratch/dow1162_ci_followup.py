import os, json, urllib.request, urllib.error

base = os.environ['PAPERCLIP_API_URL']
key = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
iid = '532c4395-0625-4e5f-b598-c885ab8aa99f'

body = """## CI·배포 확인 완료

앞 댓글에서 "실행 중"이라고 남긴 파이프라인 결과입니다.

- CI `35950352384` **녹색** — Type Check / Lint / Unit Tests / Build 4개 잡 전부 통과
- Fly Deploy `35950414842` **성공** → 프로덕션 반영 완료
- 작업 기록: `docs/WORK_LOG_20260924_DOW1162_LISTING_FAVORITE_BUTTON.md` (커밋 `c2416517`)

즉 이 건은 "로컬 커밋"이 아니라 **CI 검증 + 배포까지 끝난 상태**입니다.

남은 것은 위 댓글의 판단 하나뿐입니다 — 매물 관심목록 기능을 **(A) 지금은 안 만든다** / **(B) 만든다(별도 티켓 생성)**.
(A)면 이 티켓 done으로 닫으시면 되고, (B)면 승인만 주시면 제가 백로그 티켓을 만들겠습니다.
"""


def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(
        base + path, data=data, method=method,
        headers={
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': run,
        },
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:600]}


res = req('POST', '/api/issues/%s/comments' % iid, {'body': body})
print('comment', res.get('id') or res)
