import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '입주해 — 믿을 만한 세입자인지, 믿을 만한 집인지 이제 확인할 수 있습니다'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 랜딩(/) 히어로와 같은 메시지·팔레트를 씁니다.
// 링크 미리보기와 랜딩이 다른 말을 하면 클릭한 사람이 한 번 더 이탈합니다.
const NAVY = '#0C2247'
const AMBER = '#E9A23B'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: NAVY,
          padding: '64px 72px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* 상단: 워드마크 + 상태 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-1px' }}>
            입주해
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: NAVY,
              backgroundColor: AMBER,
              fontWeight: 700,
              borderRadius: 999,
              padding: '10px 24px',
            }}
          >
            사전 신청 받는 중
          </div>
        </div>

        {/* 가운데: 히어로 카피 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 62,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-2.5px',
              lineHeight: 1.25,
            }}
          >
            믿을 만한 세입자인지,
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 62,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-2.5px',
              lineHeight: 1.25,
            }}
          >
            믿을 만한 집인지
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 62,
              fontWeight: 800,
              color: AMBER,
              letterSpacing: '-2.5px',
              lineHeight: 1.25,
            }}
          >
            이제 확인할 수 있습니다
          </div>
        </div>

        {/* 하단: 역할 3종 + 도메인 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 27, color: 'rgba(255,255,255,0.7)' }}>
            임차인은 증명하고 · 임대인은 확인하고 · 중개사는 검증합니다
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.45)' }}>ipjuhae.com</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
