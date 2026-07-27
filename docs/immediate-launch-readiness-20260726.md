# 입주해 즉시출시 운영 준비 현황

- 기준일: 2026-07-26
- 범위: 웹, PWA 설치 경험, Expo 모바일 앱, 운영 런치 게이트, 법무/특허 방향의 제품 메시지

## 출시 기준

입주해는 원본 서류를 그대로 공개하는 서비스가 아니라, 임차인·임대인·주택의 확인 항목을 분리하고 동의 범위와 거래 단계에 따라 최소 항목만 공유하는 주거 신뢰 리포트 기반 임대 매칭 플랫폼으로 운영한다.

## 완료된 코드 기준

| 영역 | 상태 | 반영 내용 |
|---|---:|---|
| 웹 첫 화면 | 완료 | coral/sage 브랜드, 신뢰 리포트 기반 메시지, 계약 전 추가 확인 문구 반영 |
| PWA | 완료 | `/manifest.webmanifest`, 앱 아이콘, maskable icon, shortcut 구성 |
| 공유/검색 노출 | 완료 | OpenGraph 이미지, favicon, Apple icon, sitemap/robots 정리 |
| 모바일 앱 | 완료 | Expo 앱 설정, 아이콘/스플래시/알림 아이콘, 주요 화면 브랜드 통일 |
| 모바일 API | 완료 | `EXPO_PUBLIC_API_URL` override, 업로드 모바일 헤더 반영 |
| 운영 검증 | 완료 | `assets:generate`, `mobile:launch-check`, `launch:check` 자산 누락 검사 |
| 법무/특허 메시지 | 완료 | 자동 안전판정이 아닌 확인 항목·검수상태·동의 기반 공유 표현 유지 |

## 출시 전 반드시 실행할 게이트

```bash
npm run assets:generate
npm run mobile:launch-check
npm run typecheck
npm run test:run
npm run build
npm run docs:public-check
```

운영 비밀값이 준비된 환경에서는 다음을 추가로 실행한다.

```bash
npm run launch:check
npm run db:migrate
LAUNCH_SMOKE_BASE_URL=https://www.ipjuhae.com LAUNCH_SMOKE_TOKEN=<secret> npm run launch:smoke
```

## 승인 필요 작업

- 운영 DB 마이그레이션 실행
- 운영 환경변수/비밀값 설정
- 배포 실행 및 도메인 연결
- Apple App Store / Google Play 빌드 및 제출
- 실제 SMS, 이메일, 스토리지, 본인확인/문서확인 provider 계약값 연결

## 운영 원칙

1. `안전`, `문제없음`, `계약 가능`처럼 확정적 판단으로 보이는 문구는 쓰지 않는다.
2. 사용자는 확인 항목, 기준일, 검수상태, 공개 범위를 볼 수 있어야 한다.
3. 동의 철회, 만료, 이의제기, 정정 요청은 리포트 공개 상태와 함께 반영되어야 한다.
4. 외부 제출자료와 앱 화면의 메시지는 "동의 기반 최소 공개"와 "거래 전 참고값"을 기준으로 통일한다.
5. 운영 릴리즈는 `launch:verify`와 배포 후 `launch:smoke`를 통과한 상태만 출시 후보로 본다.
