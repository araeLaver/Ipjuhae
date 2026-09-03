import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '입주해 - 세입자 프로필 기반 부동산 매칭',
    short_name: '입주해',
    description: '신뢰할 수 있는 세입자 프로필로 집주인과 세입자를 매칭하는 서비스',
    id: '/',
    // 사전 모집 기간: 설치형 앱은 랜딩이 아닌 서비스 홈으로 진입
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf6ef',
    theme_color: '#f0663f',
    lang: 'ko',
    categories: ['lifestyle', 'business'],
    icons: [
      {
        src: '/app-icon-256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
