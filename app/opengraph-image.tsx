import { ImageResponse } from 'next/og'

export const alt = '입주해 - 주거 신뢰 리포트 기반 임대 매칭'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#F8F5EF',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#2A211F',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 128,
            height: 128,
            borderRadius: 32,
            background: 'linear-gradient(135deg, #B95545 0%, #61765B 100%)',
            fontSize: 72,
            marginBottom: 28,
          }}
        >
          🏠
        </div>
        <div
          style={{
            fontSize: 72,
            color: '#2A211F',
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          입주해
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#7A5E55',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          주거 신뢰 리포트 기반 임대 매칭 플랫폼
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: '#61765B',
            border: '1px solid #D6CABF',
            borderRadius: 999,
            padding: '8px 24px',
            background: '#FFFDF9',
          }}
        >
          확인 항목 기반 · 동의 기반 공유 · 거래 단계별 최소 공개
        </div>
      </div>
    ),
    { ...size }
  )
}
