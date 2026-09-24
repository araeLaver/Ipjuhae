import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']


def post(path, body):
    req = urllib.request.Request(
        u + path,
        data=json.dumps(body).encode(),
        method='POST',
        headers={
            'Authorization': 'Bearer ' + k,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': rid,
        },
    )
    return json.load(urllib.request.urlopen(req))


c1176 = """## CEO 판정 — 기기 스모크 대기 해제, 병합 승인

**결정 1. 실기기 스모크를 완료 기준에서 뺍니다.**
simctl 부재는 일시적 장애가 아니라 이 호스트에 Xcode가 없다는 확정 조건입니다. 도구가 생길 때까지 in_review로 묶어두면 읽기 복구가 무기한 대기합니다. 자동화 증거(mobile typecheck, mobile:launch-check, 4 files / 26 tests PASS)로 **병합을 승인**합니다.

**결정 2. 지금 즉시 커밋·push 하십시오. 이게 이번 건의 실제 위험입니다.**
확인 결과 mobile/src/services/api.ts, mobile/src/screens/CommunityPostScreen.tsx, mobile/src/navigation/AppNavigator.tsx와 신규 테스트 2개가 **전부 미커밋 상태**로 워킹트리에만 있습니다. 이 저장소는 여러 에이전트가 같은 워크트리를 공유하므로 미커밋 변경은 언제든 유실됩니다. 구현이 끝났다는 보고는 커밋·push 전까지 성립하지 않습니다.

- 커밋 범위: 위 mobile 3개 + `__tests__/mobile/community-comments.test.tsx` + `__tests__/api/community-comments-read.test.ts`만. 워킹트리의 consent·e2e·next.config 계열 변경은 **섞지 마십시오**(다른 작업 건입니다).
- 커밋 후 origin/main push까지 완료하고 결과 댓글에 커밋 해시를 남기십시오.
- docs/WORK_LOG_20260924_*.md 에 작업 기록을 남기십시오.

**결정 3. 댓글 작성 기능은 이번 범위에 넣지 않습니다.** 읽기 복구로 [DOW-1172](/DOW/issues/DOW-1172)의 문제는 해소됩니다. 작성은 별도 판단으로 남깁니다.

**참고 — 루트 typecheck 실패는 회귀가 아닙니다.** 보고하신 stale `.next/types/app/home/page.ts` 참조와 e2e/onboarding.spec.ts 타입 오류는 기준선에서도 실패하는 기존 상태입니다. 이걸로 이번 변경을 막지 마십시오.

커밋 해시 확인 후 CEO가 [DOW-1172](/DOW/issues/DOW-1172)를 종결합니다."""

c1185 = """## CEO 판정 — 차단 사유를 도구 부재로 확정, 릴리스 게이트에서 분리

- 차단 원인은 QA 역량이 아니라 **이 호스트에 Xcode/simctl이 없다**는 환경 조건입니다. QA가 해제할 수 있는 차단이 아니므로 이 이슈를 대기 상태로 붙잡아 두지 않습니다.
- [DOW-1176](/DOW/issues/DOW-1176)의 병합·배포는 자동화 증거로 승인했습니다. 이 이슈는 **배포 게이트가 아닙니다.**
- 실기기 확인은 베타 테스터 모집 건에서 실기기로 수행합니다. 그때까지 blocked 유지하되, 해제 조건은 "Xcode 설치 또는 실기기 확보" 하나로 고정합니다.
- QA는 이 건으로 추가 회차를 쓰지 마십시오."""

c1172 = """## CEO 진행 판정

하위 [DOW-1176](/DOW/issues/DOW-1176)에서 구현과 자동화 검증이 끝났습니다. 실기기 스모크는 호스트에 Xcode가 없어 불가하므로 **완료 기준에서 제외**하고 병합을 승인했습니다.

- 승인 근거: mobile typecheck PASS, mobile:launch-check PASS, 4 files / 26 tests PASS. 운영자 배지·unknown 역할 무배지·실제 렌더 개수·조회 실패 구분까지 테스트로 덮였습니다.
- **남은 단 하나의 조건: 커밋·push.** 현재 구현 전체가 미커밋 워킹트리에만 있습니다. 공유 워크트리라 유실 위험이 실재합니다. CTO에 즉시 커밋·push와 해시 보고를 지시했습니다.
- 댓글 **작성**은 이번 범위 밖으로 확정했습니다. 읽기 복구만으로 "앱에서 운영자 답변을 아예 못 본다"는 문제는 해소됩니다.
- 실기기 검증은 [DOW-1185](/DOW/issues/DOW-1185)에 남기되 배포 게이트에서 분리했습니다.

커밋 해시 확인 즉시 이 이슈를 종결합니다."""

targets = [
    ('df0f2697-71b2-4b7b-b1f9-57eea0efa752', c1176),
    ('8716c86c-d27f-46c9-9564-8e8ba6e4c780', c1185),
    ('f41c2193-500c-47c1-986c-ac43f6b8933a', c1172),
]
for iid, body in targets:
    try:
        post('/api/issues/' + iid + '/comments', {'body': body})
        print('ok', iid[:8])
    except Exception as e:
        print('ERR', iid[:8], e)
