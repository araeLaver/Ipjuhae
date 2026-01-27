import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { Profile, Verification, ReferenceResponse } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

// GET: 공개 프로필 조회 (동적 신뢰점수 포함)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
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

    // 완료된 레퍼런스 응답 조회
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

    return NextResponse.json({
      profile: {
        ...profile,
        trust_score: scoreBreakdown.total,
      },
      verification,
    })
  } catch (error) {
    console.error('Get public profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
