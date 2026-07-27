import type { MetadataRoute } from 'next'

const APP_NAME = '입주해'
const APP_DESCRIPTION = '주거 신뢰 리포트 기반 임대 매칭 플랫폼'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} - ${APP_DESCRIPTION}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8F5EF',
    theme_color: '#B95545',
    categories: ['lifestyle', 'business', 'productivity'],
    lang: 'ko-KR',
    dir: 'ltr',
    icons: [
      {
        src: '/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: '매물 찾기',
        short_name: '매물',
        description: '조건과 확인 항목을 함께 비교합니다.',
        url: '/listings',
        icons: [{ src: '/app-icon-192.png', sizes: '192x192' }],
      },
      {
        name: '프로필 확인',
        short_name: '프로필',
        description: '동의 기반으로 공유되는 확인 항목을 관리합니다.',
        url: '/profile',
        icons: [{ src: '/app-icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
