# 독립 dead-man Actions 운영 경로

[DOW-1267](/DOW/issues/DOW-1267)의 CTO 운영 승인은 유지됩니다. 로컬 Fly 인증 대신 기존 GitHub Actions `FLY_API_TOKEN`을 사용합니다. [DOW-1491](/DOW/issues/DOW-1491)의 CEO가 `OPS_ALERT_EMAIL`과 받은편지함 수신 시각 확인 담당자를 지정해야 운영 연결을 마칠 수 있습니다.

## 준비 및 검증

1. 지정된 수신 주소를 production environment의 `OPS_ALERT_EMAIL`에 저장합니다. 호스트 비밀 저장 경로에서 생성한 별도 무작위 32자 이상 값을 GitHub production `OPS_HEARTBEAT_SECRET`으로 주입합니다. 호스트 `PAPERCLIP_DEADMAN_PING_TOKEN`과 같은 값이며 기존 CRON/JWT 비밀을 재사용하지 않습니다. 비밀값을 댓글·파일·명령행 인자로 전달하지 않습니다.
2. `ops-deadman-secrets.yml`을 main에서 `mode=validate`로 실행합니다. 누락·짧은 token·공백/개행·단일 주소 형식 오류는 값 출력 없이 실패합니다.
3. `mode=stage`는 검증 후 stdin으로 두 값만 Fly `ipjuhae-production`에 저장합니다. `OPS_DEADMAN_ENABLED`와 제품의 다른 secrets는 변경하지 않습니다.

[Fly 공식 문서](https://fly.io/docs/apps/secrets/)의 `--stage`는 즉시 배포를 생략하지만 다음 머신 시작/업데이트 시 적용됩니다. staging은 다른 배포에도 영향을 줄 수 있으므로 작업 시간을 운영 담당자와 공유합니다. 기존 비밀값이 있다면 회전으로 취급하여 호스트와 함께 조정해야 합니다.

## 활성화 및 실측

CTO 승인 후보 앱 `0730fd3b`, QA `adef965b`, 호스트 `506515fb`/QA `aed67d02` 포함 여부와 현재 배포 이미지를 확인합니다. migration 045를 포함한 plan 결과를 확인하고 pending이 없으면 중복 적용하지 않습니다. CTO가 실행한 Actions run `38159218614`는 known=51/applied=51/pending=0이었으며 현재 상태는 적용 직전 다시 확인합니다.

기존 Resend 설정과 운영 수신자를 확인하고, 승인된 배포 경로에서 기능 활성화·이미지 반영·호스트 연결을 집행합니다. 이 준비 workflow 자체는 활성화나 배포를 하지 않습니다. 첫 authenticated POST 200과 DB `receivedAt`, 독립 evaluation 증가를 확인한 뒤 제어된 stale/회복 및 메일 수신 시험을 수행합니다. `/api/health`, preflight, 기존 gist/Actions는 유지합니다.

`configuration_invalid`, `scheduler_start_failed`, `tick_failed`, `tick_overlap`, `delivery_retry`, `delivery_uncertain`를 운영 수집에 연결합니다. uncertain 이벤트는 Resend 이력을 확인한 후 후속 통지를 판단합니다. rollback은 `docs/ops-deadman-fly.md`와 호스트 연결 문서를 따릅니다.

| 측정 | 결과 |
| --- | --- |
| 관측 UTC 시작/종료 | 미측정 |
| 기대/실제 판정 횟수 및 최대 공백 | 미측정 |
| 마지막 핑 → stale 판정 | 미측정 |
| stale → Resend 수락 → 받은편지함 도착 | 미측정 |
| 핑 회복 → 회복 판정/메일 수신 | 미측정 |

명목 판정 지연은 360초(6분)입니다. 운영 실측 전 실제 지연 상한으로 보고하지 않습니다.
