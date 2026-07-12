import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { User, Profile, Verification, ReferenceResponse, ProfileView } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { getClientIp } from '@/lib/rate-limit'
import { getTenantProfileConsent, getTenantProfileVisibility, getVisibleConsentFields, maskProfileName, toConsentRole } from '@/lib/consent'
import { recordAccessAudit } from '@/lib/access-audit'
import { getRequestContext } from '@/lib/request-context'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { requestId, traceId } = getRequestContext(request)

  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다', request_id: requestId, trace_id: traceId },
        { status: 401 }
      )
    }

    const fullUser = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [user.id]
    )

    if (fullUser?.user_type !== 'landlord') {
      return NextResponse.json(
        { error: '임대인 전용 API입니다', request_id: requestId, trace_id: traceId },
        { status: 403 }
      )
    }

    const { id } = await params

    const profile = await queryOne<Profile & { profile_image_url?: string | null }>(
      `SELECT p.*, u.profile_image AS profile_image_url
       FROM profiles p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    )

    if (!profile) {
      return NextResponse.json(
        { error: '세입자 프로필을 찾을 수 없습니다', request_id: requestId, trace_id: traceId },
        { status: 404 }
      )
    }

    const consent = await getTenantProfileConsent(profile.user_id)
    const visibility = getTenantProfileVisibility(consent)
    const visibleFields = getVisibleConsentFields(visibility)

    const visibleVerification = visibility.verification
      ? await queryOne<Verification>('SELECT * FROM verifications WHERE user_id = $1', [profile.user_id])
      : null

    const referenceResponses = await query<ReferenceResponse>(
      `SELECT rr.* FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'`,
      [profile.user_id]
    )

    const visibleReferenceResponses = visibility.references ? referenceResponses : []

    const scoreBreakdown = visibility.trust_score
      ? calculateTrustScore({
          profile,
          verification: visibleVerification,
          referenceResponses: visibleReferenceResponses,
        })
      : {
          profile: 0,
          employment: 0,
          income: 0,
          credit: 0,
          reference: 0,
          total: 0,
        }

    const actorIp = getClientIp(request)
    const actorUserAgent = request.headers.get('user-agent')
    const actorRole = toConsentRole(fullUser.user_type)

    void recordAccessAudit({
      actorUserId: user.id,
      actorRole,
      actorIp,
      actorUserAgent,
      targetType: 'tenant_profile',
      targetId: id,
      targetUserId: profile.user_id,
      purpose: 'tenant_profile_view',
      fieldsViewed: visibleFields,
      requestId,
      traceId,
      metadata: {
        profileConsentVersion: consent?.consent_version ?? null,
      },
    })

    await query<ProfileView>(
      `INSERT INTO profile_views (landlord_id, profile_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (landlord_id, profile_id)
       DO UPDATE SET viewed_at = NOW()`,
      [user.id, id]
    )

    const visibleProfile = {
      ...profile,
      name: visibility.basic_profile ? profile.name : maskProfileName(profile.name),
      age_range: visibility.basic_profile ? profile.age_range : null,
      family_type: visibility.basic_profile ? profile.family_type : null,
      pets: visibility.basic_profile ? profile.pets : [],
      smoking: visibility.basic_profile ? profile.smoking : false,
      stay_time: visibility.basic_profile ? profile.stay_time : null,
      duration: visibility.basic_profile ? profile.duration : null,
      noise_level: visibility.basic_profile ? profile.noise_level : null,
      bio: visibility.bio ? profile.bio : null,
      trust_score: visibility.trust_score ? scoreBreakdown.total : 0,
      profile_image_url: visibility.contact
        ? (profile as Profile & { profile_image_url?: string | null }).profile_image_url ?? null
        : null,
    }

    return NextResponse.json({
      profile: visibleProfile,
      verification: visibleVerification,
      referenceResponses: visibleReferenceResponses,
      trustScoreBreakdown: visibility.trust_score
        ? scoreBreakdown
        : {
            profile: 0,
            employment: 0,
            income: 0,
            credit: 0,
            reference: 0,
            total: 0,
          },
      consent: {
        consentVersion: consent?.consent_version ?? null,
        fields: visibility,
      },
      request_id: requestId,
      trace_id: traceId,
    })
  } catch (error) {
    console.error('Get tenant detail error:', error)
    return NextResponse.json(
      { error: '세입자 조회 중 오류가 발생했습니다', request_id: requestId, trace_id: traceId },
      { status: 500 }
    )
  }
}
