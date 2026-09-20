# 워크로그 2026-09-21 — 모바일 출시 자산 검사 게이트 편입 (DOW-1115 종료)

## 요약

DOW-1115(모바일 splash 자산 규격 불일치)를 QA 재검증 통과 확인 후 종료하고,
`mobile:launch-check`를 `launch:verify` 체인에 편입했다.

## 결정

출시 규격을 **1242x2436으로 유지**하고 자산·생성기를 규격에 맞췄다.
검사 기준을 현재 자산(1024x1024)에 맞춰 완화하는 선택지는 채택하지 않았다.
1242x2436은 Expo splash 기본 규격이고, 1024x1024는 아이콘 생성 경로에서 잘못 흘러든 값이다.

## 변경

| 커밋 | 내용 |
| --- | --- |
| `016ee6ad` | `scripts/generate-app-icons.mjs`가 splash를 1242x2436으로 생성, 자산 재생성 (이전 런) |
| `e419d2c7` | `launch:verify`에 `mobile:launch-check` 추가 |

변경 후 체인:

```
launch:verify = launch:check && mobile:launch-check && typecheck && test:run && build
```

`mobile:launch-check`를 typecheck/test/build 앞에 둔 이유: env 없이 수초 내 끝나므로
무거운 단계 전에 자산 회귀를 먼저 잡는다.

## 검증

- `node scripts/check-mobile-launch.mjs` → `mobile:launch-check passed` (종료 코드 0)
- QA(DOW-1116) 독립 재검증: 이전 자산으로 교체 시 종료 코드 1 + `should be 1242x2436, got 1024x1024` 재현,
  생성기 재실행 후 커밋 자산과 바이트 일치 및 재통과 확인

## 남은 사항

- 실기기 splash 렌더링 확인과 배포 smoke는 미수행 — EAS 빌드 시점 대상.
- `main`이 `origin/main`보다 앞서 있다. main push는 CI→Fly 배포를 트리거하므로 이번 런에서 push하지 않았다.

## 보류 중 (차단 유지, 이번 런 변화 없음)

- DOW-1097 / DOW-1098: 단일 게이트 DOW-1102(`.env` 주입) 대기.
  `/Users/down/.paperclip/instances/default/.env` 여전히 부재.
  집행 주체를 보드 → CTO로 바꾸는 제안이 DOW-1102에 올라가 있고 아직 회신 없음.
  새 맥락이 없어 중복 코멘트는 남기지 않았다.
