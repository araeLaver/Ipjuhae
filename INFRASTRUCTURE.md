# 입주해 (Ipjuhae) 인프라 구성 가이드

이 문서는 입주해 프로젝트의 운영 인프라 구성 및 마이그레이션 정보를 기록합니다.

## 🏗 전체 아키텍처 (Gold Standard)

| 구성 요소 | 서비스 | 리전 | 역할 |
| :--- | :--- | :--- | :--- |
| **Web Server** | [Fly.io](https://fly.io) | `nrt` (Tokyo) | Next.js 서버 및 Socket.IO 실행 |
| **Database** | [Neon](https://neon.tech) | `ap-southeast-1` (Singapore) | PostgreSQL 데이터베이스 (Serverless) |
| **Storage** | [Cloudflare R2](https://www.cloudflare.com/r2/) | Global | 프로필 이미지, 매물 사진 등 파일 저장 |
| **DNS/CDN** | [Cloudflare](https://www.cloudflare.com/) | Global | 도메인 관리, 보안(WAF), SSL, 접속 가속 |

## 🔗 접속 정보

- **운영 URL:** [https://www.ipjuhae.com](https://www.ipjuhae.com)
- **개발/배포 주소:** [https://ipjuhae-production.fly.dev](https://ipjuhae-production.fly.dev)
- **관리자 도메인:** [https://dash.cloudflare.com](https://dash.cloudflare.com) (DNS/Storage)
- **DB 대시보드:** [https://console.neon.tech](https://console.neon.tech)

## 🛠 주요 설정 파일

1.  **`fly.toml`**: Fly.io 배포 설정 (Tokyo 리전, 8000번 포트)
2.  **`Dockerfile`**: 도커 이미지 빌드 정의 (Standalone 모드 최적화)
3.  **`db/migrate.ts`**: 전체 스키마 마이그레이션 실행기 (Neon 연동 완료)
4.  **`lib/storage.ts`**: Cloudflare R2(S3 API 호환) 연동 로직

## 🔑 환경 변수 (Fly.io Secrets)

보안을 위해 다음 변수들은 Fly.io의 `Secrets`로 관리됩니다.

- `DATABASE_URL`: Neon Postgres 연결 문자열
- `JWT_SECRET`: 유저 인증용 토큰 키 (모바일/웹 공용)
- `S3_ACCESS_KEY_ID`: Cloudflare R2 액세스 키
- `S3_SECRET_ACCESS_KEY`: Cloudflare R2 비밀 키
- `CRON_SECRET`: 예약 작업(Cleanup, 만료 처리) 인증 키

## 🚀 유지보수 및 배포

- **수동 배포:** `fly deploy` (루트 디렉토리에서 실행)
- **인증서 확인:** `fly certs check ipjuhae.com`
- **DB 마이그레이션:** `npm run db:migrate` (DATABASE_URL 설정 필요)

## 📱 모바일 앱 연동 (준비됨)

- **Auth:** Web Cookie 외에 `Authorization: Bearer <token>` 헤더를 통한 인증 지원 완료.
- **API Base:** `https://www.ipjuhae.com/api` 를 사용하도록 모바일 프로젝트(`mobile/`) 설정됨.

---
*최종 업데이트: 2026-06-09 by Gemini CLI*
