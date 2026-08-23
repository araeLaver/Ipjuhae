/** @type {import('next').NextConfig} */
const scriptSources = ["'self'", "'unsafe-inline'"]
if (process.env.NODE_ENV === 'development') scriptSources.push("'unsafe-eval'")

const nextConfig = {
  output: 'standalone',

  // Performance
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

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
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
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
