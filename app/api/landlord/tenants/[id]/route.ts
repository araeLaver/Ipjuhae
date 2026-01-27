import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { User, Profile, Verification, ReferenceResponse, ProfileView } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: 세입자 상세 조회 (열람 기록 추가)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 사용자 타입 확인
    const fullUser = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [user.id]
    )

    if (fullUser?.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    const { id } = await params

    // 프로필 조회
    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE id = $1',
      [id]
    )

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    // 인증 정보 조회
    const verification = await queryOne<Verification>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [profile.user_id]
    )

    // 레퍼런스 응답 조회
    const referenceResponses = await query<ReferenceResponse>(
      `SELECT rr.* FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'`,
      [profile.user_id]
    )

    // 동적 신뢰점수 계산
    const scoreBreakdown = calculateTrustScore({
      profile,
      verification,
      referenceResponses,
    })

    // 열람 기록 추가/업데이트 (UPSERT)
    await query<ProfileView>(
      `INSERT INTO profile_views (landlord_id, profile_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (landlord_id, profile_id)
       DO UPDATE SET viewed_at = NOW()`,
      [user.id, id]
    )

    return NextResponse.json({
      profile: {
        ...profile,
        trust_score: scoreBreakdown.total,
      },
      verification,
      referenceResponses,
      trustScoreBreakdown: scoreBreakdown,
    })
  } catch (error) {
    console.error('Get tenant detail error:', error)
    return NextResponse.json({ error: '세입자 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
