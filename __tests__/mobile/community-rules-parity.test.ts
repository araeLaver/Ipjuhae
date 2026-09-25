/**
 * DOW-1196 — 앱과 웹의 커뮤니티 게시판 판정이 같은지 본다.
 *
 * 앱은 Metro가 `mobile/`을 루트로 묶어서 저장소 루트의 `lib/community.ts`를
 * 그대로 import하지 못한다. 그래서 `mobile/src/lib/community.ts`에 옮겨 적었는데,
 * 두 벌이 된 규칙은 조용히 갈라진다 — 한쪽만 고치고 다른 쪽을 잊는 식으로.
 *
 * 여기서는 둘 다 import해서 **역할 × 게시판 전 조합**의 판정이 같은지 본다.
 * 한쪽만 바꾸면 이 테스트가 깨진다.
 */

import { describe, expect, it } from 'vitest'
import * as web from '@/lib/community'
import * as app from '../../mobile/src/lib/community'

/** `null`(비로그인)과 서버가 실제로 내려주는 역할 전부, 그리고 모르는 값 하나. */
const USER_TYPES = [null, undefined, 'tenant', 'landlord', 'broker', 'admin', 'nonsense'] as const

describe('앱·웹 커뮤니티 규칙이 갈라지지 않는다', () => {
  it('게시판 목록과 라벨이 같다', () => {
    expect(app.COMMUNITY_AUDIENCES).toEqual(web.COMMUNITY_AUDIENCES)
    expect(app.AUDIENCE_LABELS).toEqual(web.AUDIENCE_LABELS)
    expect(app.ROLE_LABELS).toEqual(web.ROLE_LABELS)
  })

  it('읽을 수 있는 게시판 판정이 역할마다 같다', () => {
    for (const t of USER_TYPES) {
      expect(app.readableAudiences(t), `userType=${t}`).toEqual(web.readableAudiences(t))
    }
  })

  it('쓸 수 있는 게시판 판정이 역할 × 게시판 전 조합에서 같다', () => {
    for (const t of USER_TYPES) {
      for (const a of web.COMMUNITY_AUDIENCES) {
        expect(app.canPostTo(t, a), `userType=${t} audience=${a}`).toBe(web.canPostTo(t, a))
      }
    }
  })

  it('기본 대상 게시판 판정이 탭 × 역할 전 조합에서 같다', () => {
    for (const t of USER_TYPES) {
      for (const tab of web.COMMUNITY_AUDIENCES) {
        expect(app.defaultAudienceFor(tab, t), `tab=${tab} userType=${t}`).toBe(
          web.defaultAudienceFor(tab, t)
        )
      }
    }
  })

  it('역할→본인 게시판 변환이 같다', () => {
    for (const t of USER_TYPES) {
      expect(app.userTypeToAudience(t), `userType=${t}`).toBe(web.userTypeToAudience(t))
    }
  })
})

describe('DOW-1136 확정 규칙을 그대로 지킨다', () => {
  it('기본 대상은 지금 보고 있는 탭이다', () => {
    // 임대인 탭을 읽다가 글쓰기를 누르면 임대인 게시판에 올라가야 한다.
    expect(app.defaultAudienceFor('landlord', 'tenant')).toBe('landlord')
    expect(app.defaultAudienceFor('broker', null)).toBe('broker')
  })

  it('탭이 all일 때만 로그인 사용자는 본인 역할 게시판이다', () => {
    expect(app.defaultAudienceFor('all', 'landlord')).toBe('landlord')
    expect(app.defaultAudienceFor('all', 'broker')).toBe('broker')
    expect(app.defaultAudienceFor('all', null)).toBe('all')
    expect(app.defaultAudienceFor('all', 'admin')).toBe('all')
  })

  it('공인중개사는 전체와 본인 판만 읽는다', () => {
    expect(app.readableAudiences('broker')).toEqual(['all', 'broker'])
    expect(app.readableAudiences(null)).toEqual(['all'])
  })
})


it('웹과 앱 커뮤니티 역할 라벨이 같다', async () => {
  const web = await import('../../lib/community')
  const mobile = await import('../../mobile/src/lib/community')
  const webRoles = await import('../../lib/roles')
  expect(web.ROLE_LABELS).toEqual(webRoles.ROLE_LABELS)
  expect(mobile.ROLE_LABELS).toEqual(webRoles.ROLE_LABELS)
})
