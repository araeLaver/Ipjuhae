# 전 에이전트 런 exit 41 즉사 — 원인 규명 보고 (DOW-1248)

- 작성: DevOps 에이전트 (`8fc1e08e`)
- 측정 시각: 2026-09-27 00:0x KST (데이터 구간 2026-09-26 00:00~14:30 UTC)
- 데이터 출처: 임베디드 Postgres `heartbeat_runs` 295건(종결) + 같은 런의 로그 원문 295건 전수(`data/run-logs/**.ndjson`, 누락 0건)

## 결론 한 줄

`exit 41`은 **Paperclip 버그가 아니라 gemini CLI가 API 키 없이 즉사할 때 쓰는 종료 코드**이고,
그 앞에서 **codex(ChatGPT 사용량 한도)와 claude(5시간 창 한도, overage 크레딧 소진)가 연달아 거절**되어
폴백 사슬 3단이 모두 무너진 결과입니다. 즉 **실행 용량(유료 한도) 고갈**이 진짜 원인입니다.

## 1. exit 41의 정체 — 확정

폴백 사슬의 **마지막 단계 gemini_local**이 남긴 종료 코드입니다. 재현 실측:

```
$ env -u GEMINI_API_KEY gemini --approval-mode yolo -p hi   # cwd=/tmp
exit 41
stderr[0] YOLO mode is enabled. All tool calls will be automatically approved.
stderr[2] When using Gemini API, you must specify the GEMINI_API_KEY environment variable.
```

`"YOLO mode is enabled. ..."`는 **정상 배너**입니다. 이것이 런의 `error` 필드로 올라간 지점은 한 줄로 지목됩니다.

- `packages/adapters/gemini-local/src/server/execute.ts:417` — `const stderrLine = firstNonEmptyLine(attempt.proc.stderr);`
- 같은 파일 `:431` — `errorMessage: (attempt.proc.exitCode ?? 0) === 0 ? null : fallbackErrorMessage`

`firstNonEmptyLine`이 **stderr 첫 줄**을 집으므로 실제 실패 사유(3번째 줄, API 키 없음)가 아니라 배너가 저장됩니다.
codex-local 어댑터에는 노이즈 제거기(`stripCodexRolloutNoise`)가 있는데 gemini-local에는 없습니다.

추가로, 런에 기록되는 `exit_code`는 **마지막으로 시도한 어댑터**의 종료 코드입니다
(`server/src/services/heartbeat.ts:2960` → `exitCode: adapterResult.exitCode`).
그래서 158~235건이 전부 `41` 하나로 보였습니다. **1차 실패(codex)의 사유는 어디에도 남지 않습니다.**

## 2. 로그 원문이 지목하는 실제 죽는 지점

내 런 `037dcd86-f4e6-42ea-b551-a8d41e1ddf3d`의 ndjson 전문(18줄) 요약:

| 줄 | stream | 내용 |
| --- | --- | --- |
| 3 | stdout | `{"type":"error","message":"You’ve hit your usage limit. ... try again at Oct 2nd, 2026 4:08 PM."}` ← **codex 1차 실패** |
| 5 | stderr | `[paperclip] Adapter codex_local failed (exit=1...), trying fallback: claude_local` |
| 11 | stdout | `{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"out_of_credits"}}` ← **claude 2차 실패** |
| 13 | stdout | `api_error_status:429`, `"You've hit your session limit · resets 11:30pm (Asia/Seoul)"` |
| 16 | stderr | `YOLO mode is enabled...` + `you must specify the GEMINI_API_KEY` ← **gemini 3차 실패** |
| 17 | stderr | `[paperclip] Fallback adapter gemini_local finished (exit=41)` |

### 전수 대조 (09-26 종결 런 295건, 로그 원문 기준)

| 서명 | 실패 235건 | 성공 60건 |
| --- | --- | --- |
| codex `hit your usage limit` | **235 (100%)** | 31 |
| claude `out_of_credits` | **235 (100%)** | 4 |
| claude `hit your session limit` | **235 (100%)** | 1 |
| gemini `must specify the GEMINI_API_KEY` | **235 (100%)** | 0 |

예외 0건입니다. **성공한 60건 중 31건도 codex는 이미 죽어 있었고 claude 폴백이 살려낸 런**입니다.
즉 09-26 하루 종일 1차 어댑터(codex)의 성공률은 사실상 0이고, 회사는 **claude 한 계정의 5시간 창으로만** 돌고 있었습니다.

## 3. "3시간 정전 구간"의 경계 — 5시간 한도 창의 꼬리

호스트 자원도 인증 만료도 아닙니다. **두 공급자의 5시간 사용량 창**입니다. 로그의 `resetsAt`가 직접 말해 줍니다.

| 공급자 | 로그에 찍힌 리셋 시각 (KST) |
| --- | --- |
| claude `five_hour` | **13:30 · 18:30 · 23:30** (정확히 5시간 간격) |
| claude `seven_day` | 10-02 06:00 (`allowed_warning` — 주간 한도는 아직 여유) |
| codex | **12:12 · 17:14 · 22:16** + 주간/월 한도 **10-02 16:08** |

5시간 창 안의 위치별 실패율(앵커 = claude 리셋 03:00Z):

| 창 내 경과 | 런 | 실패율 |
| --- | --- | --- |
| 0~29분 | 32 | 34% |
| 30~119분 | 85 | 62% (90~119분 구간은 4%) |
| **150~300분** | **162** | **100% (162/162)** |

창이 리셋되면 2~2.5시간 일하고, 남은 2.5시간은 **전사 100% 실패**입니다.
"08:18에 다시 살아났다"의 정체는 호스트 변화가 아니라 **창 리셋**입니다. 조치 없이 방치하면 매 5시간마다 반복됩니다.

## 4. 동시 기동 5건 97% — 우연이 아니지만 주원인도 아님

같은 초에 5건이 뜨는 사례는 09-26에 6회, **전부 `invocation_source='timer'`** 입니다(스케줄러가 due 에이전트를 한 초에 묶어 발사).
창 위치를 통제해도(리셋 후 2시간 이내로 한정) 신호가 남습니다.

| 동시 기동 | 런(창 앞 2시간) | 실패율 |
| --- | --- | --- |
| 1 | 68 | 50% |
| 2 | 28 | 43% |
| 3 | 6 | 50% |
| **5** | **15** | **93%** |

다만 표본이 15건이고, 거절된 런은 **토큰을 소비하지 않으므로** 버스트가 한도를 더 태우는 것은 아닙니다.
버스트는 "한 초에 5건이 같은 계정에 동시 진입해 같은 거절을 5번 받는" 낭비이며, 조치 대상이지만 **용량 문제를 풀지는 못합니다.**

## 5. gemini 3차 폴백은 애초에 성공할 수 없는 상태였다

- 에이전트 `adapterConfig.fallbackConfigs.gemini_local`에는 `env`가 없습니다(모델·command·`--skip-trust`만).
  게다가 **fallbackConfigs 안의 env는 해석되지 않고 조용히 버려집니다**(기존 확인 사항). → 키는 인스턴스 프로세스 환경에만 넣을 수 있습니다.
- `~/.gemini/settings.json`은 `security.auth.selectedType = "gemini-api-key"`인데 키가 없습니다.
- **OAuth(무료 Code Assist) 경로는 막혔습니다.** 격리 HOME으로 실측:

```
IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals.
reasonCode: UNSUPPORTED_CLIENT   (exit 55)
```

즉 gemini_local을 살리는 유일한 길은 **AI Studio API 키 발급**(무료 티어 존재) + 인스턴스 환경변수 주입 + 서버 재시작입니다.

## 조치안 (결정 필요, 비용 순)

| # | 조치 | 효과 | 필요 권한 |
| --- | --- | --- | --- |
| A | **Claude 크레딧 구매/플랜 상향** — 지금 `overageStatus=rejected / out_of_credits`이므로 크레딧만 채우면 5시간 창 소진 후에도 overage로 계속 돌 수 있음 | 즉시 최대 효과 | 보드(지출) |
| B | **GEMINI_API_KEY 발급(AI Studio 무료 티어) → 인스턴스 env 주입 + 재시작** | 3번째 실행 풀 확보, exit 41 서명 소멸 | 보드(키 발급·재시작 창) |
| C | **codex는 10-02 16:08까지 사실상 사용 불가** → 1차 어댑터를 claude로 잠시 승격 | 런당 10초 낭비·무의미한 1차 실패 제거 | DevOps(에이전트 설정) |
| D | 에이전트별 하트비트 주기 하향 + 타이머 스태거 → 남은 quota를 마감 트랙(G밸리 10-08)에 집중 | 우선순위 보호 | CEO(운영 정책) |
| E | 코드: gemini-local에 배너 노이즈 필터 + 폴백 사슬 소진 시 **1차 실패 사유를 런 error로 승격** | 오진 재발 방지 | 서버 재시작 창 |

**주의:** E만 하면 메시지가 정직해질 뿐 용량은 1건도 늘지 않습니다. 실패율이 내려가는 것으로 보이게 만들면 안 됩니다(DOW-1218 반복).

## 재현·검증 스크립트

- `scripts/ops/paperclip_run_failure_analysis.py` — 종결 런 전수 + 로그 원문 서명 집계
- `scripts/ops/paperclip_quota_window_analysis.py` — 5시간 창 위치별 실패율 / 동시 기동 상관 / `resetsAt` 추출
- `scripts/ops/gemini_oauth_probe.py` — 격리 HOME으로 gemini OAuth 적격성 확인(파괴적 변경 없음)
