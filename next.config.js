/** @type {import('next').NextConfig} */
const scriptSources = ["'self'", "'unsafe-inline'"]
if (process.env.NODE_ENV === 'development') scriptSources.push("'unsafe-eval'")

const nextConfig = {
  output: 'standalone',

  // Performance
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  /**
   * demo 캡처를 뜰 때만 Next.js dev indicator 배지를 끈다 (DOW-1150).
   *
   * `/demo/*`는 production에서 404라 **dev에서만 존재한다.** 그래서 이 화면의 캡처에는
   * 항상 좌하단 dev 배지가 같이 찍히는데, 그 캡처의 용도가 K-DATA 같은 외부 제출물이라
   * 제출 이미지에 개발 도구 UI가 박혀 나간다.
   *
   * 전역으로 끄지 않는 이유: 평소 개발에서는 이 배지가 빌드 상태를 알려주는 쓸모가 있다.
   * `PUBLIC_MOCK_DEMO_ENABLED`는 캡처를 뜰 때만 세우는 값이고 production에서는 애초에
   * 세워지지 않으므로, 이 조건이 일반 개발과 운영에 영향을 주지 않는다.
   */
  ...(process.env.PUBLIC_MOCK_DEMO_ENABLED === '1' ? { devIndicators: false } : {}),

  // External packages that must not be bundled (server-side native/CJS)
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass', 'bcryptjs'],

  // Webpack: provide fallbacks for Node.js built-ins in edge/client bundles
  // Prevents "Module not found: Can't resolve 'fs'" when pg is in import trace
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        net: false,
        tls: false,
        stream: false,
        crypto: false,
      }
    }
    return config
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  /**
   * 사라진 주소를 살아 있는 주소로 넘긴다.
   *
   * `/home`은 사전 모집 시절의 서비스 홈이었다. 2026-09-17 커뮤니티 전환 이후
   * `/`가 서비스 홈이자 유일한 색인 대상인데, `/home`은 `robots: index false`로
   * 색인에서 빠진 채 헤더 로고의 목적지로만 남아 있었다. 화면을 지웠으므로
   * 주소도 정리한다.
   *
   * permanent(308)인 이유: 이 주소는 다시 쓰지 않는다. 검색엔진과 브라우저가
   * 캐시해도 되는 이동이다. 307로 두면 색인에 죽은 주소가 계속 남는다.
   *
   * 클라이언트 리다이렉트(`router.push`)로 넣지 않는다. 그렇게 하면 크롤러와
   * JS 없는 요청이 빈 화면을 받는다.
   */
  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '0' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // script/style 'unsafe-inline' 유지: nonce 전환은 정적 페이지를
              // 동적 렌더링으로 바꾸는 트레이드오프가 있어 별도 결정으로 분리.
              `script-src ${scriptSources.join(' ')}`,
              // 브랜드 폰트 Pretendard를 jsdelivr CDN에서 로드(app/globals.css @import).
              // 이 호스트가 없으면 CSP가 스타일시트를 차단해 폰트가 시스템 폰트로 폴백된다.
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              // img-src는 'https:' 유지: 소셜 로그인 프로필 이미지(kakao/naver/
              // google CDN)를 렌더하므로 특정 호스트로 좁히면 아바타가 깨진다.
              "img-src 'self' data: blob: https:",
              // ws: 제거(https 페이지에서 평문 ws는 브라우저가 어차피 차단).
              "connect-src 'self' wss: https://vitals.vercel-insights.com",
              // 순수 추가 하드닝(회귀 위험 없음):
              "object-src 'none'", // 플러그인/<object>·<embed> 주입 차단
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests", // 혼합 콘텐츠 방지(전 리소스 https)
            ].join('; '),
          },
        ],
      },
    ]
  },
}

// Sentry: 나중에 DSN 설정 후 withSentryConfig로 래핑 가능
module.exports = nextConfig
