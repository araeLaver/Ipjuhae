# Android 알림 권한 재검증 — 2026-09-26

대상: DOW-1173. 기존 비운영 QA APK가 설치된 `emulator-5554`에서 확인했다.
`com.google.android.gms` 패키지 존재를 재확인했다. 이번 실행은 권한 UI 관측만 수행했으며
API endpoint 재검증과 DB 조회는 하지 않았다. 계정·토큰 값은 기록하지 않는다.

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| 1. 권한 회수 후 재시작 | 통과(UI 범위) | 권한 회수 후 process가 종료됐다. 재실행 후 Switch OFF 및 기기 권한 비활성 안내 확인 |
| 2. 재시작 없이 권한 회수 후 복귀 | 실행 못함 | `pm revoke` 전 PID 9113, 직후 process 없음, 복귀 후 PID 10543. 같은 process 복귀가 아니므로 통과로 인정하지 않음 |
| 3. 권한 재허용 후 OFF 유지 | 통과(UI 범위) | PID 10543 유지, HOME → `pm grant` → 복귀 후 Switch OFF 및 권한 허용 안내 확인 |
| 4. 비행기 모드에서 오류 억제 | 실행 못함 | 등록된 토큰이 선행 조건. 현재 ON 전환 시 토큰 등록 실패 안내 관측 |
| 5. 권한 회수 후 서버 토큰 삭제 | 실행 못함 | FCM 구성 후 해당 기기·계정의 등록 행을 먼저 입증해야 함 |
| 6. 복귀 시 updated_at 불변 | 실행 못함 | 동일 |
| 7. 계정 전환 시 토큰 소유자 변경 | 실행 못함 | 동일 |

권한 회수 전 Switch ON을 실제 확인했다. 재허용은 자동으로 Switch를 켜지 않았다.
이번 검증은 ADB 권한 전이를 사용했으며 사람이 설정 앱에서 조작한 검증과 구분한다.
측정 스크립트와 UI 원문은 gitignored `.paperclip-scratch/recheck-notifications.py`,
`.paperclip-scratch/notification-recheck-20260926.jsonl`에 있다.

이전 보고의 “1~4번은 FCM과 무관”은 정정한다. `initializeNotifications()`는
`PUSH_TOKEN_KEY`에 등록 토큰이 있는 경우에만 재등록 실패 안내를 억제하므로 4번도 막힌다.
테이블 전체 행 수가 아니라 해당 기기·계정의 행으로 선행 조건을 검증하도록 체크리스트를 보완했다.

2번은 QA에게 OS 설정 UI 경로의 process 유지 여부와 대체 실행 환경 검토를 요청한다.
4~7번은 DOW-1222의 보드 FCM 구성 이후 재실행한다. full mobile release No-Go를 유지한다.
