# Trust Platform 다음 작업

## 우선순위 원칙

현재 코드·DB·테스트·빌드 단계는 완료됐다. 다음 단계는 기능 추가보다 실제 배포환경에서의 인수 검증과 외부기관 연결을 우선한다.

## P0. 프리뷰 배포 및 브라우저 인수검증

### 작업

1. Vercel 프리뷰 프로젝트 연결
2. Preview 환경변수 등록
3. `/trust-center`, `/admin/trust`, `/admin/trust/operations` 접근 확인
4. 데스크톱 1440px, 태블릿 768px, 모바일 390px 레이아웃 확인
5. 탭 전환, 정정심사, 추출검수, 출처등록 다이얼로그 확인
6. 인증 만료·403·빈 데이터·API 오류 상태 확인

### 완료 조건

- 관리자와 일반 사용자 역할별 페이지 접근이 올바르다.
- 가로 스크롤, 잘림, 겹침이 없다.
- 주요 작업 다이얼로그가 키보드와 모바일에서 동작한다.
- 브라우저 콘솔 오류가 없다.

## P0. 운영 환경변수와 Cron 검증

### 필수 환경변수

- `DATABASE_URL`
- `DB_SCHEMA=ipjuhae`
- `JWT_SECRET`
- `DISCLOSURE_SIGNING_KEY`
- `CRON_SECRET`
- `STORAGE_PROVIDER=s3`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`

### 완료 조건

- Trust maintenance와 Outbox cron이 2회 이상 연속 성공한다.
- 실패 이벤트가 backoff 후 재처리된다.
- 공개 만료·동의 철회·거래단계 변경 시 패키지가 회수된다.
- 전달 결과가 `trust_delivery_receipts`에 기록된다.

## P1. 파일럿 데이터 시나리오

### 필수 시나리오

1. 임차인 인증서류 제출→관리자 승인→사실 생성→점수 갱신
2. 거래 생성→단계 전환→최소공개 발급→단계 변경 회수
3. 계약 완료→양측 레퍼런스 제출→동시 공개→신뢰 그래프 갱신
4. 공유식별자·시간 burst→공모 위험→edge 격리
5. 사실 정정 요청→결과 정지→관리자 승인→선택 재계산→통지
6. 증빙 만료→fact STALE→점수·추천·공개 연쇄 반영

### 완료 조건

- 각 시나리오의 DB 상태, 이벤트, 감사로그와 UI 결과가 일치한다.
- A1~A4 증빙 매트릭스의 처리단계별 캡처 또는 로그를 확보한다.

## P1. 외부기관 연동

### 권장 순서

1. OCR 공급자
2. 본인인증 공급자
3. 등기·건축물 데이터
4. 시세·가격 데이터
5. 보증보험 자격 데이터

### 연동 원칙

- 법무·약관 검토 후 Source Registry에 등록한다.
- 자격증명은 Vercel Secret 또는 전용 비밀관리시스템에 저장한다.
- 요청 전 별도 동의와 목적·허용필드를 확인한다.
- 원문 응답은 최소 보관하고 검증값으로 변환한다.
- 공급자 오류·지연·비용·개인정보 위험을 검증경로 선택에 반영한다.

## P1. 모델·정책 승인

- 임차인, 임대인, 주택 모델 가중치 운영 승인
- 공모격리 임계값 0.7의 파일럿 조정
- 거래단계별 최소 claim 정책 확정
- 자동결정 설명·사람 검토·이의제기 정책 법무 검토
- 모델·정책 승인자와 적용일 기록

## P2. 변리사 전달 및 실시예 증거

### 전달 자료

- 구현 증빙 매트릭스
- API·이벤트·상태전이 문서
- SHA-256 evidence manifest
- 정상·분쟁·공모·정정 시나리오 결과
- UI 화면과 DB 상태 캡처
- 모델·정책 버전 및 사유코드 목록

### 확인 요청

- A1과 A4의 통합 독립항 또는 분리 여부
- A2의 거래단계·최소집합·회수 결합 신규사항 판단
- A3의 계약 edge·동시공개·공모격리 필수 청구요소
- B1 검증경로 추천과 B2 조건추천의 후속출원 범위

## P2. 운영 관측성·보안

- Outbox 실패율, cascade 지연, 공개 회수시간 대시보드
- 관리자 원문 접근의 할당 기반 권한과 이중검수
- 문서 악성코드 검사와 다운로드 제한
- 보안·개인정보 침해사고 대응 훈련
- 의존성 취약점 16건의 영향 분석과 단계적 업데이트

## 다음 실행 명령

```powershell
node --env-file=.env.local node_modules/tsx/dist/cli.mjs db/migrate.ts
node --env-file=.env.local node_modules/tsx/dist/cli.mjs db/backfill-trust-ledger.ts
node --env-file=.env.local scripts/trust-platform-smoke.mjs
npm run test:run
npm run build
npm run patent:evidence
```

