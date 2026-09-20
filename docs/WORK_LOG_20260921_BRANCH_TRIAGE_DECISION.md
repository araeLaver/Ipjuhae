# 워크로그 2026-09-21 — 미병합 브랜치 triage 결정 (DOW-1110)

## 요약

`feature/community-trust-docs-kakao` 브랜치(55커밋, 2026-07-04~08-03)의 처리 방향을 확정했다. **병합하지 않는다.** 대신 아카이브 태그로 영구 보존하고, 실제로 유실된 항목만 선별 복원한다.

## 판정 근거 (직접 확인)

| 확인 항목 | 명령 | 결과 |
|---|---|---|
| 브랜치 격차 | `git rev-list --left-right --count main...feature/community-trust-docs-kakao` | `227	55` — main이 227커밋 앞섬 |
| guard 스크립트 유실 | `ls scripts/` | `check-shared-logic.mjs`, `check-test-suite-health.mjs`만 존재. `check-public-disclosure-terms.mjs` / `check-mobile-launch.mjs` 없음 |
| 브랜치 존재 | `git branch -a` | 로컬 + `origin` 양쪽 존재 |

triage 자체는 빌더가 수행했고(55커밋 전부 4분류), CTO는 위 3개 사실을 재확인한 뒤 결정을 내렸다.

## 병합하지 않는 이유

1. **충돌 86파일** — `git merge-tree` 기준
2. **migration 번호 정면 충돌** — 브랜치의 `021`~`025`와 main의 `021`~`025`가 서로 다른 마이그레이션. main은 현재 044까지 진행
3. **제품 코드는 대부분 main이 상위집합** — 브랜치 마지막 커밋 이후 7주간 main이 같은 영역을 다시 구현했다

## 집행한 것 — 아카이브 태그

```
archive/community-trust-docs-kakao -> f0ff1b9f
```

origin 푸시 완료. `git ls-remote --tags origin`으로 확인했다.

**왜 태그를 먼저 만들었나.** 원래 제안은 "복원 완료 후 브랜치 삭제"였다. 그 순서대로 가면 복원이 덜 된 상태에서 삭제될 경우 소스가 사라진다. 순서를 뒤집어서 보존을 먼저 집행했으므로, 이제 브랜치 삭제는 되돌릴 수 있는 작업이 됐다.

부수 효과로 태그는 "미병합 브랜치" 목록에 뜨지 않는다. 같은 유실 오해가 반복되지 않는다.

## 실제 유실분 — 선별 복원 대상

| 이슈 | 내용 | 우선순위 |
|---|---|---|
| DOW-1112 | `check-public-disclosure-terms.mjs` 이식 (206줄, 과장 표현 + 비밀 토큰 차단) | critical |
| DOW-1111 | 7월 지원사업·품질증거 문서 76건 복원 (충돌 0) | high |
| DOW-1113 | `check-mobile-launch.mjs` 이식 (Expo 신원값 + 에셋 5종 해상도 검증) | medium |

DOW-1112를 critical로 올렸다. 지원사업 신청서가 계속 나가는 중이고 JWT 서명키 유출(DOW-1097) 직후라 대외 노출 위험이 가장 크다. 문서 복원은 태그로 안전해진 만큼 급도가 한 단계 내려갔다.

두 스크립트 모두 **그대로 cherry-pick하면 실패한다**:
- `check-public-disclosure-terms.mjs` — `DEFAULT_BASE_FILES`가 main에 없는 `docs/modoo-startup-*.md`를 가리킨다. 경로 재지정 필요
- `check-mobile-launch.mjs` — `sharp` 의존성 추가 필요

## DOW-632 재판정 — "이미 반영됨"으로 종료

이 이슈는 "브랜치의 수정 2건을 main에 재적용"으로 열렸지만, 전제가 틀렸다. 파일 기준으로는 "main에 없음"이 맞았고 **기능 기준으로는 main이 상위집합**이다.

| 브랜치 커밋 | main 현재 상태 |
|---|---|
| `378813a0` OS 권한 동기화 (24줄 순수함수) | `mobile/src/services/notificationService.ts` 152줄 — `getPermissionsAsync()` 게이팅 + 권한 거부 시 저장 선호값 강제 `false` + `openNotificationSettings()` 유도 |
| `fb283456` 계정 삭제 원자성 | `app/api/account/delete/route.ts` 단일 `transaction()` — properties 비공개화 · users 익명화 · password_hash 무효화 · 연관 레코드 삭제. `migration-037-users-deleted-at` 적용됨 |

## 재발 방지 — 삭제 전 검증 조건

DOW-632가 두 달간 "고쳐진 것"으로 오인된 원인은 완료 보고를 파일이 아니라 말로 확인했기 때문이다. 후속 3건은 각각 다음을 남겨야 done으로 인정한다:

- DOW-1111 — main 기준 복원된 `docs/` 파일 수, 76건 대비 실제 건수와 누락 사유
- DOW-1112 — main에서 `npm run docs:public-check` **실제 실행 출력**
- DOW-1113 — main에서 `npm run mobile:launch-check` **실제 실행 출력**

"통과했습니다"가 아니라 출력 붙여넣기다.

세 건이 이 조건을 충족해 done이 되면 브랜치를 삭제한다. 태그는 영구 보존한다.
