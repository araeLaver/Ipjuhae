# DOW-1224 — 베타 초대 게이트 제거의 프로덕션 실측 (계정 생성 없이)

2026-09-27 (KST). 담당: 입주해 에이전트.

## 먼저 정정 — 게이트는 프로덕션에서 **이미 꺼져 있었다**

운영 DB 읽기 전용 조회 결과다 (`scripts/qa/prod_readonly_query.py signup-gate`, 집계만 출력).

```json
{"adminAccountExists":true,"betaEnabled":"false","userCount":11,"community043_044Applied":2}
```

`beta_config.beta_enabled = "false"`. 즉 코드를 걷어내기 전에도 **운영 가입은 초대 토큰 없이 열려 있었다.** 이 티켓의 값은 "막혀 있던 가입을 열었다"가 아니라 **DB 값 하나로 전체 가입이 막히는 잠재 장애 버튼과, 폐기된 `waitlist` 테이블 의존을 코드에서 없앤 것**이다. 기대 효과를 과장하지 않기 위해 여기 적어 둔다.

> 기존 메모("프로덕션 seed 는 `true`")는 현행이 아니다. 로컬 e2e DB 는 여전히 `true` 라서 `e2e/global-setup.ts` 의 시드는 그대로 필요하다.

## 실측 — 계정을 만들지 않고 어디까지 확인했나

`scripts/qa/probe_signup_gate_prod.py`

```
POST /api/auth/signup (초대 토큰 없음, 기존 계정 이메일) → 400
  error 문구: 이미 사용 중인 이메일입니다
PASS — 게이트 없이 중복 검사까지 도달 (계정 생성 없음)
```

- **이미 존재하는 계정** 이메일로 보냈다. 존재 여부는 위 읽기 전용 조회의 `adminAccountExists` 로 먼저 확인했다 — 없는 이메일로 쐈다면 그 순간 운영 계정이 하나 생긴다.
- 중복 검사(`route.ts:37`)는 비밀번호를 보기 전에 돌기 때문에 인증 시도가 아니다.
- `Origin`·`Referer` 를 붙여야 한다. 안 붙이면 middleware CSRF 가 **403 "CSRF 검증 실패"** 로 막는데, 이걸 초대 게이트의 403 으로 읽으면 거짓 FAIL 이 된다(첫 실행에서 실제로 그렇게 났다). 프로브가 두 403 을 구분하도록 고쳐 뒀다.

### 이 프로브의 한계 — 전/후를 구분하지 못한다

`beta_enabled` 가 `false` 였으므로 **게이트 제거 전에도 같은 400 이 나왔다.** 이 실측이 증명하는 것은 "초대 토큰 없는 요청이 403 으로 막히지 않고 일반 검증 경로로 간다" 하나다. 전/후를 프로덕션에서 구분하려면 `beta_enabled` 를 `true` 로 되돌려 대조군을 만들어야 하는데, 그건 운영 가입을 실제로 잠그는 행위라 하지 않았다.

전/후 구분은 코드 레벨에서 닫혀 있다 — `__tests__/api/auth-signup.test.ts` 의 게이트 가드 3건이 라우트를 게이트 버전으로 되돌리면 전부 실패한다(되돌려 실패 확인 완료, 커밋 `26c005ce` 메시지에 기록).

## 배포 상태

- `26c005ce` 는 원격 `main` HEAD 의 조상 — 배포된 revision 에 포함돼 있다
- [CI `36269051818`](https://github.com/araeLaver/Ipjuhae/actions/runs/36269051818) success · [Fly Deploy `36269177228`](https://github.com/araeLaver/Ipjuhae/actions/runs/36269177228) success
- 이번 회차에 push·배포·revert·운영 계정 생성은 하지 않았다

## 남긴 파일

| 파일 | 역할 |
|---|---|
| `scripts/qa/prod_readonly_query.py` | 운영 DB 읽기 전용 집계 조회. `flyctl ssh console -C` 가 셸을 거치지 않고 공백으로 토큰을 쪼개며 **따옴표까지 지운다** — 정규식 리터럴 `.source` + base64url 로 따옴표·공백·`/` 를 전부 없앤 명령을 만든다 |
| `scripts/qa/probe_signup_gate_prod.py` | 계정 생성 없는 signup 경로 실측 (CSRF 403 과 게이트 403 구분) |
