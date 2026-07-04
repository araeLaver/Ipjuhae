import { notifyTrustScoreUpdated } from '@/lib/notifications'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  Profile,
  Verification,
  ReferenceResponse,
  ReferenceResponseItem,
} from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

export interface TrustScoreRecalculationResult {
  userId: string
  previousTrustScore: number
  nextTrustScore: number
  profileScore: number
  verificationScore: number
  referenceScore: number
}

export async function recalculateTrustScoreForUser(
  userId: string,
): Promise<TrustScoreRecalculationResult | null> {
  const profile = await queryOne<Profile>(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId],
  )

  if (!profile) {
    logger.warn('신뢰점수 재계산 대상 프로필이 없습니다', { userId })
    return null
  }

  const verification = await queryOne<Verification>(
    'SELECT * FROM verifications WHERE user_id = $1',
    [userId],
  )

  const referenceResponses = await query<ReferenceResponse>(
    `SELECT rr.*
     FROM reference_responses rr
     JOIN landlord_references lr ON lr.id = rr.reference_id
     WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1
       AND lr.status = 'completed'`,
    [userId],
  )

  const referenceResponseItems = await query<ReferenceResponseItem>(
    `SELECT rri.*
     FROM reference_response_items rri
     JOIN reference_responses rr ON rr.id = rri.response_id
     JOIN landlord_references lr ON lr.id = rr.reference_id
     WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1
       AND lr.status = 'completed'`,
    [userId],
  )

  const scoreBreakdown = calculateTrustScore({
    profile,
    verification,
    referenceResponses,
    referenceResponseItems,
  })

  const previousTrustScore = profile.trust_score
  const profileScore = scoreBreakdown.profile
  const verificationScore = scoreBreakdown.employment + scoreBreakdown.income + scoreBreakdown.credit
  const referenceScore = scoreBreakdown.reference
  const nextTrustScore = scoreBreakdown.total

  await query(
    `UPDATE profiles
       SET profile_score = $1,
           verification_score = $2,
           reference_score = $3,
           trust_score = $4,
           updated_at = NOW()
     WHERE user_id = $5`,
    [profileScore, verificationScore, referenceScore, nextTrustScore, userId],
  )

  if (nextTrustScore !== previousTrustScore) {
    notifyTrustScoreUpdated({
      toUserId: userId,
      newScore: nextTrustScore,
      delta: nextTrustScore - previousTrustScore,
    }).catch((error) => {
      logger.error('신뢰점수 알림 전송 실패', { userId, error })
    })
  }

  return {
    userId,
    previousTrustScore,
    nextTrustScore,
    profileScore,
    verificationScore,
    referenceScore,
  }
}

export async function recalculateTrustScores(
  userIds: string[],
): Promise<TrustScoreRecalculationResult[]> {
  const uniqueUserIds = Array.from(new Set(userIds))
  const results: TrustScoreRecalculationResult[] = []

  for (const userId of uniqueUserIds) {
    try {
      const result = await recalculateTrustScoreForUser(userId)
      if (result) {
        results.push(result)
      }
    } catch (error) {
      logger.error(`신뢰점수 재계산 실패: ${userId}`, { userId, error })
    }
  }

  return results
}
