import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '입주해 - 세입자 프로필 기반 부동산 매칭'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 96, marginBottom: 8 }}>🏠</div>
        <div
          style={{
            fontSize: 72,
            color: 'white',
            fontWeight: 700,
            letterSpacing: '-2px',
            marginBottom: 16,
          }}
        >
          입주해
        </div>
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          세입자 프로필 기반 부동산 매칭 플랫폼
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 999,
            padding: '8px 24px',
          }}
        >
          ipjuhae.com
        </div>
      </div>
    ),
    { ...size }
  )
}
