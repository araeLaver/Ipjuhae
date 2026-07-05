import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import {
  User,
  Profile,
  Verification,
  ReferenceResponse,
  ReferenceResponseItem,
  ValidationValue,
  ReferenceDispute,
} from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { evaluateProfileAccess } from '@/lib/consent-access'

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
       WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1 AND lr.status = 'completed'`,
      [profile.user_id]
    )

    const responseIds = referenceResponses.map((r) => r.id)
    const referenceResponseItems =
      responseIds.length === 0
        ? []
        : await query<ReferenceResponseItem>(
            `SELECT rri.*
             FROM reference_response_items rri
             WHERE rri.response_id = ANY($1::uuid[])`,
            [responseIds],
          )

    const referenceDisputes = responseIds.length === 0
      ? []
      : await query<ReferenceDispute>(
          `SELECT rd.*
             FROM reference_disputes rd
             JOIN reference_responses rr ON rr.id = rd.response_id
             JOIN landlord_references lr ON lr.id = rr.reference_id
            WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1
              AND lr.status = 'completed'`,
          [profile.user_id],
        )

    const validationValues = await query<ValidationValue>(
      `SELECT *
         FROM validation_values
        WHERE owner_user_id = $1
          AND subject_type = 'tenant'
          AND subject_id = $1
          AND status = 'valid'`,
      [profile.user_id],
    )

    const propertySafetyRows = await query<{ avg_safety_score: string }>(
      `
        SELECT AVG(pss.safety_score)::FLOAT AS avg_safety_score
          FROM property_safety_scores pss
          INNER JOIN landlord_references lr
            ON lr.target_property_id = pss.property_id
         WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1
           AND lr.target_property_id IS NOT NULL
           AND lr.status = 'completed'
           AND (pss.expires_at IS NULL OR pss.expires_at >= NOW())
      `,
      [profile.user_id],
    )

    const propertySafetyScore = Number(propertySafetyRows[0]?.avg_safety_score ?? null)

    const access = await evaluateProfileAccess(request, {
      viewerUserId: user.id,
      ownerUserId: profile.user_id,
      viewerRole: user.user_type,
      targetId: profile.id,
      requestedFields: ['trust_score', 'profile', 'verification', 'reference', 'reference_count', 'contact'],
      enforceConsent: process.env.ENFORCE_PATENT_CONSENT === 'true',
    })

    if (!access.allowed) {
      return NextResponse.json({ error: '열람 동의가 필요합니다' }, { status: 403 })
    }

    if (!access.canViewContact) {
      profile.name = '익명'
    }

    // 동적 신뢰점수 계산
    const scoreBreakdown = calculateTrustScore({
      profile,
      verification,
      referenceResponses,
      referenceResponseItems,
      referenceDisputes,
      validationValues,
      propertySafetyScore,
    })

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
