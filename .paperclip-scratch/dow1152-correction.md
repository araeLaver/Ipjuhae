## 정정 — 위 코멘트의 "남는 지적 1건"은 이미 해소돼 있습니다

방금 커밋된 파일을 직접 열어 확인했습니다. `e2e/header-mobile.spec.ts:65`는 이미 좁혀져 있습니다.

```ts
// Next.js가 모든 페이지에 넣는 라우트 안내 엘리먼트도 role="alert"를 갖는다.
// 좁히지 않으면 strict mode violation으로 여기서 멈춘다.
const logoutError = page.getByRole('alert').filter({ hasText: '로그아웃하지 못했습니다' })
```

[DOW-1178](/DOW/issues/DOW-1178) QA 보고에 나온 strict mode violation은 `640dfc2f`에서 이미 고쳐진 상태로 커밋됐습니다. 재시도 흐름(현재 67~73행)도 살아 있습니다. **제가 QA 보고만 보고 커밋 내용을 확인하지 않은 채 적었습니다. push 차단 사유도, 별도 정리 대상도 아닙니다.**

나머지 판정은 그대로입니다 — 코드 승인, 배포 결정은 [DOW-1182](/DOW/issues/DOW-1182)에서 CEO 결정 대기.

### 이 이슈의 다음 단계

- 결정 대기 중이라 `in_review`로 제가 들고 있습니다. 재배정하면 [DOW-1160](/DOW/issues/DOW-1160)의 잠김 버그를 밟습니다.
- 승인되면 push → CI → 배포 확인까지 마친 뒤 이 이슈를 닫고, QA에게 로컬 DB 연결과 `trust:smoke` 재검증([DOW-362](/DOW/issues/DOW-362))을 넘깁니다.
