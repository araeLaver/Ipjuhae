# 2026-09-24 DevOps — launch-smoke 운영 토큰 실행 (DOW-1131 / DOW-362)

QA가 가짜 서버로 재현한 16개 시나리오는 통과했지만, 합격 기준 1~3번은 운영 토큰이 필요해 QA가 직접 돌릴 수 없었다. DevOps가 실제 운영 토큰으로 한 번 찍은 기록을 남긴다.

## 실행 방법

토큰은 저장소·로그 어디에도 남기지 않는다. Fly 머신에서 직접 읽어 자식 프로세스 환경에만 주입했다.

```
fly ssh console -a ipjuhae-production -C "printenv LAUNCH_SMOKE_TOKEN"   # 값은 캡처만, 출력 안 함
LAUNCH_SMOKE_BASE_URL=https://www.ipjuhae.com node scripts/launch-smoke.mjs
```

주의: 이 셸에서는 `flyctl`이 `~/.fly/config.yml`을 읽지 못하고 `no access token available`로 죽는다.
`config.yml`의 `access_token`을 `FLY_API_TOKEN` 환경변수로 넘겨야 동작한다.

대상 커밋: `main` @ `52464426` (origin/main과 동기).

## 결과 — 합격

```
총 5개 체크, 실패 0개
✅ launch-smoke-route | status=503
✅ health | status=200
✅ listings-public | status=200
✅ phone-validation | status=400
✅ admin-route-protection | status=403
허용된 예상 실패(기본값): sms, verification
⚠️  known gap | sms | ...
⚠️  known gap | verification | ...
EXIT_CODE=0
```

- 기준 1 `exit 0` ✅ / 기준 2 known gap 정확히 2줄 ✅ / 기준 3 필수 5종 회귀 0줄 ✅
- route는 여전히 `503`인데 종료 코드가 `0`. 수정 전이었다면 무조건 `1`이었다 — 이 티켓의 핵심이 운영에서 확인됐다.

## 대조군 2건 — exit 0이 공짜로 나온 게 아님을 확인

가짜 서버가 아니라 운영 응답 그대로 두고 환경변수만 바꿨다.

| 대조군 | 기대 | 실제 |
|---|---|---|
| `LAUNCH_SMOKE_EXPECTED_FAILURES=` (엄격) | 1 | `1`, `❌ 회귀` 2줄 |
| `LAUNCH_SMOKE_EXPECTED_FAILURES=sms,verification,database` | 0 + 경고 | `0`, `⚠️ database은(는) 필수 항목이라 허용 목록에 넣어도 무시됩니다` |

엄격 모드가 `1`을 내므로 본 실행의 `0`은 무판정 통과가 아니다.

## 남은 것

- **CI 게이트 미연동.** 배포 후 자동 게이트로 쓰려면 러너에 `LAUNCH_SMOKE_TOKEN` 주입이 필요하다. 별건.
- 비필수 항목(`sms`/`verification`) 스키마 변형은 여전히 조용히 통과한다. 허용목록이 3종 이상으로 늘면 다시 본다. 현재는 DOW-912에서 사람이 추적.
