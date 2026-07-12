import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { Profile, Verification, ReferenceResponse } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { getCurrentUser } from '@/lib/auth'
import { getClientIp } from '@/lib/rate-limit'
import {
  getTenantProfileConsent,
  getTenantProfileVisibility,
  getVisibleConsentFields,
  maskProfileName,
  toConsentRole,
} from '@/lib/consent'
import { recordAccessAudit } from '@/lib/access-audit'
import { getRequestContext } from '@/lib/request-context'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { requestId, traceId } = getRequestContext(request)

  try {
    const { id } = await params
    const actor = await getCurrentUser().catch(() => null)

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
      [id]
    )

    if (!profile) {
      return NextResponse.json(
        { error: '세입자 프로필을 찾을 수 없습니다', request_id: requestId, trace_id: traceId },
        { status: 404 }
      )
    }

    const consent = actor?.user_type === 'landlord'
      ? await getTenantProfileConsent(profile.user_id)
      : null
    const visibility = actor?.user_type === 'landlord' && consent
      ? getTenantProfileVisibility(consent)
      : null

    const verification = visibility?.verification
      ? await queryOne<Verification>('SELECT * FROM verifications WHERE user_id = $1', [profile.user_id])
      : null

    const referenceResponses = await query<ReferenceResponse>(
      `SELECT rr.* FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'`,
      [profile.user_id]
    )

    const visibleReferenceResponses = !visibility || visibility.references ? referenceResponses : []
    const scoreBreakdown = visibility?.trust_score
      ? calculateTrustScore({
          profile,
          verification,
          referenceResponses: visibleReferenceResponses,
        })
      : { profile: 0, employment: 0, income: 0, credit: 0, reference: 0, total: 0 }

    const visibleFields = visibility
      ? getVisibleConsentFields(visibility)
      : ['basic_profile', 'trust_score', 'bio', 'verification', 'references', 'contact']

    const visibleProfile = visibility
      ? {
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
        }
      : profile

    void recordAccessAudit({
      actorUserId: actor?.id ?? null,
      actorRole: toConsentRole(actor?.user_type),
      actorIp: getClientIp(request),
      actorUserAgent: request.headers.get('user-agent'),
      targetType: 'tenant_profile',
      targetId: profile.id,
      targetUserId: profile.user_id,
      purpose: 'tenant_profile_view',
      fieldsViewed: visibleFields,
      requestId,
      traceId,
    })

    return NextResponse.json({
      profile: visibleProfile,
      verification,
      referenceResponses: visibleReferenceResponses,
      trustScoreBreakdown: scoreBreakdown,
      request_id: requestId,
      trace_id: traceId,
    })
  } catch (error) {
    console.error('Get public profile error:', error)
    return NextResponse.json(
      { error: '프로필 조회 중 오류가 발생했습니다', request_id: requestId, trace_id: traceId },
      { status: 500 }
    )
  }
}
