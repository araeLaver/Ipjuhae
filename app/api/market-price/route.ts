import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  fetchTrades,
  fetchRents,
  narrowByArea,
  isRealEstateEnabled,
  type BuildingKind,
} from '@/lib/real-estate-price'

/**
 * 실거래가 조회.
 *
 * `/check`에서 "매매 시세"를 직접 찾아 넣어야 하는 마찰을 없앤다.
 * 우리가 시세를 추정해 주는 게 아니라 **국토부에 신고된 실제 거래**를 보여주고
 * 고르는 건 사용자가 한다. 그 구분이 이 제품의 전제다.
 *
 * 로그인 없이 쓴다. `/check` 자체가 가입 없이 쓰는 화면이라
 * 여기서 계정을 요구하면 앞뒤가 안 맞는다.
 *
 * 개발계정은 하루 1,000회다. 조회 한 번에 6개월치를 부르므로 실제로는
 * 6회가 나간다. 캐시가 있어도 호출 제한을 반드시 둔다.
 */

const schema = z.object({
  /** 법정동코드 앞 5자리. 다음 우편번호 API의 bcode 앞 5자리. */
  lawdCd: z.string().regex(/^\d{5}$/, '지역 코드가 올바르지 않습니다'),
  /** 단지 이름 일부. 비우면 그 지역 전체 */
  keyword: z.string().trim().max(40).optional(),
  /** 전용면적 제곱미터. 주면 비슷한 면적만 남긴다 */
  areaM2: z.coerce.number().min(0).max(1000).optional(),
  kind: z.enum(['apt', 'rowhouse', 'officetel']).optional(),
  /** trade = 매매, rent = 전월세 */
  type: z.enum(['trade', 'rent']).optional(),
})

export async function GET(request: Request) {
  if (!isRealEstateEnabled()) {
    return NextResponse.json({ error: '실거래가 조회를 사용할 수 없습니다' }, { status: 503 })
  }

  const limited = rateLimit(`market:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 10 * 60_000,
  })
  if (!limited.success) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 })
  }

  const url = new URL(request.url)
  const parsed = schema.safeParse({
    lawdCd: url.searchParams.get('lawdCd') ?? '',
    keyword: url.searchParams.get('keyword') ?? undefined,
    areaM2: url.searchParams.get('areaM2') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '잘못된 요청입니다' },
      { status: 400 }
    )
  }

  const { lawdCd, keyword = '', areaM2, kind, type = 'trade' } = parsed.data
  const buildingKind = (kind ?? 'apt') as BuildingKind

  try {
    if (type === 'rent') {
      const all = await fetchRents(lawdCd, keyword, buildingKind)
      const narrowed = areaM2 ? narrowByArea(all, areaM2) : all

      // 전세와 월세를 나눠 돌려준다. 섞으면 평균이 무너진다 —
      // 월세 낀 계약은 보증금이 낮게 잡히므로 "전세가 이 정도"를 잘못 보여준다.
      const jeonse = narrowed.filter((r) => r.monthlyRentManwon === 0)
      const wolse = narrowed.filter((r) => r.monthlyRentManwon > 0)

      return NextResponse.json({
        count: narrowed.length,
        jeonse: jeonse.slice(0, 30),
        wolse: wolse.slice(0, 10),
        source: '국토교통부 실거래가',
      })
    }

    const all = await fetchTrades(lawdCd, keyword, buildingKind)
    const narrowed = areaM2 ? narrowByArea(all, areaM2) : all

    // 같은 단지·같은 면적이 여러 건이면 최근 것만 보여준다.
    // 목록이 길면 무엇을 골라야 할지 오히려 모른다.
    return NextResponse.json({
      count: narrowed.length,
      trades: narrowed.slice(0, 20),
      source: '국토교통부 실거래가',
    })
  } catch (error) {
    logger.error('실거래가 조회 오류', { error })
    return NextResponse.json({ error: '실거래가를 불러오지 못했습니다' }, { status: 502 })
  }
}
