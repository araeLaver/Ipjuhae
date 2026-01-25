# 렌트미 MVP 설정 가이드

## 1. 외부 서비스 설정

### Supabase 설정
1. https://supabase.com 에서 계정 생성/로그인
2. "New Project" 클릭하여 프로젝트 생성
3. Project Settings > API 에서 다음 값 복사:
   - Project URL
   - anon public key
   - service_role key (설정에서 확인)

### Supabase 데이터베이스 설정
1. Supabase 대시보드에서 SQL Editor 열기
2. `supabase/schema.sql` 파일 내용 복사하여 실행

### Supabase Auth 설정 (OAuth)

#### 카카오 로그인
1. https://developers.kakao.com 에서 앱 생성
2. 앱 설정 > 플랫폼 > Web에 도메인 추가:
   - 개발: `http://localhost:3000`
   - 프로덕션: `https://your-domain.vercel.app`
3. 제품 설정 > 카카오 로그인 활성화
4. 동의항목에서 필요한 정보 설정 (닉네임, 이메일 등)
5. Supabase 대시보드 > Authentication > Providers > Kakao:
   - Client ID (REST API 키) 입력
   - Client Secret 입력
   - Redirect URL을 카카오 개발자 콘솔에 등록

#### 구글 로그인
1. https://console.cloud.google.com 에서 프로젝트 생성
2. APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs
3. Application type: Web application
4. Authorized redirect URIs 추가:
   - `https://[your-project].supabase.co/auth/v1/callback`
5. Supabase 대시보드 > Authentication > Providers > Google:
   - Client ID 입력
   - Client Secret 입력

### OpenAI API 설정
1. https://platform.openai.com 에서 계정 생성
2. API Keys 메뉴에서 새 키 생성
3. 생성된 키 복사 (한 번만 표시됨)

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 앱 확인

## 4. Vercel 배포

### 방법 1: Vercel CLI
```bash
npm install -g vercel
vercel
```

### 방법 2: GitHub 연동
1. GitHub에 코드 푸시
2. https://vercel.com 에서 프로젝트 가져오기
3. 환경 변수 설정 (Settings > Environment Variables)
4. 배포

### 프로덕션 OAuth 설정
배포 후 OAuth redirect URL 업데이트:
- 카카오: `https://your-domain.vercel.app`
- 구글: `https://[your-project].supabase.co/auth/v1/callback`
- Supabase Site URL: `https://your-domain.vercel.app`

## 5. 테스트 체크리스트

- [ ] 카카오 로그인 동작
- [ ] 구글 로그인 동작
- [ ] 온보딩 Step 1 (기본 정보) 저장
- [ ] 온보딩 Step 2 (라이프스타일) 저장
- [ ] AI 자기소개서 생성
- [ ] 프로필 완성 및 조회
- [ ] 프로필 공유 링크 동작
- [ ] 공개 프로필 페이지 접근 (로그인 없이)
- [ ] 모바일 반응형 확인

## 문제 해결

### "relation profiles does not exist" 에러
- Supabase SQL Editor에서 schema.sql 실행 확인

### OAuth 리다이렉트 에러
- Supabase 대시보드에서 Site URL 설정 확인
- OAuth Provider의 Redirect URI 설정 확인

### AI 소개서 생성 실패
- OpenAI API 키 확인
- API 사용량/결제 확인
