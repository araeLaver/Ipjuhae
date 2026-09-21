import type { MetadataRoute } from 'next'

/**
 * 홈 화면에 설치되는 앱의 정체.
 *
 * 구글 플레이 공개는 테스터 12명 14일에 막혀 있다. 그동안 안드로이드와 아이폰
 * 모두에서 바로 쓸 수 있는 길은 이것뿐이라, 설치형 앱으로 제대로 만들어 둔다.
 *
 * start_url이 `/home`이었다. 사전 모집 시절의 서비스 홈인데 지금은 그 화면으로
 * 시작할 이유가 없다. 설치한 이유는 계산기다. 네이티브 앱의 첫 탭도 같다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '입주해 - 보증금 점검',
    short_name: '입주해',
    description:
      '전세 계약 전에 보증금이 안전한지 계산합니다. 등기부와 시세에서 읽은 숫자를 넣으면 경매로 넘어갔을 때 얼마가 남는지까지 알려드립니다.',
    id: '/',
    start_url: '/check',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf6ef',
    theme_color: '#f0663f',
    lang: 'ko',
    categories: ['lifestyle', 'finance', 'utilities'],
    shortcuts: [
      {
        name: '보증금 점검',
        short_name: '점검',
        description: '숫자를 넣어 보증금이 안전한지 확인합니다',
        url: '/check',
      },
      {
        name: '커뮤니티',
        short_name: '커뮤니티',
        description: '계약 전에 물어보는 곳',
        url: '/',
      },
    ],
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
