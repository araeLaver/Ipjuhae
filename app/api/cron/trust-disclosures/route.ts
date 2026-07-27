/**
 * Cron: 검증값/동의/리포트 공개 만료 처리
 *
 * GET /api/cron/trust-disclosures
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * 매일 실행.
 * - 유효기간이 지난 validation_values는 stale/expired로 전환
 * - 유효기간이 지난 consent에 연결된 report_bundles는 expired로 회수
 * - expires_at이 지난 report_bundles는 expired로 회수
 * - 회수된 report_bundles와 연결된 disclosure_decisions는 expired로 전환
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'
import { recalculateTrustScores } from '@/lib/trust-score-recalculator'

interface ExpiredValidationValue {
  id: string
  owner_user_id: string
}

interface ExpiredConsent {
  id: string
  owner_user_id: string
}

interface ExpiredReportBundle {
  id: string
  disclosure_decision_id: string | null
  owner_user_id: string
}

interface ExpiredDisclosureDecision {
  id: string
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function expiredMetadata(reason: string) {
  return JSON.stringify({
    expired_by: 'cron_trust_disclosures',
    reason,
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const expiredValidationValues = await query<ExpiredValidationValue>(
      `UPDATE validation_values
          SET status = 'stale',
              review_status = 'expired',
              reason_codes = ARRAY(
                SELECT DISTINCT code
                  FROM unnest(COALESCE(reason_codes, ARRAY[]::text[]) || ARRAY['VALUE_EXPIRED']) AS code
              ),
              updated_at = NOW()
        WHERE valid_until IS NOT NULL
          AND valid_until < NOW()
          AND status <> 'stale'
        RETURNING id, owner_user_id`,
      [],
    )

    const expiredConsents = await query<ExpiredConsent>(
      `SELECT id, owner_user_id
         FROM consents
        WHERE valid_until IS NOT NULL
          AND valid_until < NOW()
          AND revoked_at IS NULL`,
      [],
    )

    const expiredByDate = await query<ExpiredReportBundle>(
      `UPDATE report_bundles
          SET status = 'expired',
              revoked_at = NOW(),
              revocation_reason = 'bundle_expired',
              updated_at = NOW()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        RETURNING id, disclosure_decision_id, owner_user_id`,
      [],
    )

    const expiredConsentIds = uniqueStrings(expiredConsents.map((row) => row.id))
    const expiredByConsent = expiredConsentIds.length > 0
      ? await query<ExpiredReportBundle>(
          `UPDATE report_bundles
              SET status = 'expired',
                  revoked_at = NOW(),
                  revocation_reason = 'consent_expired',
                  updated_at = NOW()
            WHERE status = 'active'
              AND consent_id = ANY($1::uuid[])
            RETURNING id, disclosure_decision_id, owner_user_id`,
          [expiredConsentIds],
        )
      : []

    const expiredValidationOwnerIds = uniqueStrings(expiredValidationValues.map((row) => row.owner_user_id))
    const expiredByValidationValue = expiredValidationOwnerIds.length > 0
      ? await query<ExpiredReportBundle>(
          `UPDATE report_bundles
              SET status = 'expired',
                  revoked_at = NOW(),
                  revocation_reason = 'validation_value_expired',
                  updated_at = NOW()
            WHERE status = 'active'
              AND owner_user_id = ANY($1::uuid[])
            RETURNING id, disclosure_decision_id, owner_user_id`,
          [expiredValidationOwnerIds],
        )
      : []

    const expiredBundles = [
      ...expiredByDate,
      ...expiredByConsent,
      ...expiredByValidationValue,
    ]
    const disclosureDecisionIds = uniqueStrings(expiredBundles.map((row) => row.disclosure_decision_id))

    const decisionsByBundle = disclosureDecisionIds.length > 0
      ? await query<ExpiredDisclosureDecision>(
          `UPDATE disclosure_decisions
              SET result = 'expired',
                  revoked_at = NOW(),
                  metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE result = 'granted'
              AND id = ANY($1::uuid[])
            RETURNING id`,
          [disclosureDecisionIds, expiredMetadata('report_bundle_expired')],
        )
      : []

    const decisionsByConsent = expiredConsentIds.length > 0
      ? await query<ExpiredDisclosureDecision>(
          `UPDATE disclosure_decisions
              SET result = 'expired',
                  revoked_at = NOW(),
                  metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE result = 'granted'
              AND consent_id = ANY($1::uuid[])
            RETURNING id`,
          [expiredConsentIds, expiredMetadata('consent_expired')],
        )
      : []

    if (expiredValidationOwnerIds.length > 0) {
      await recalculateTrustScores(expiredValidationOwnerIds)
    }

    const expiredDisclosureDecisionIds = uniqueStrings([
      ...decisionsByBundle.map((row) => row.id),
      ...decisionsByConsent.map((row) => row.id),
    ])

    const result = {
      ok: true,
      expiredValidationValues: expiredValidationValues.length,
      expiredConsents: expiredConsents.length,
      expiredReportBundles: expiredBundles.length,
      expiredDisclosureDecisions: expiredDisclosureDecisionIds.length,
      recalculatedUsers: expiredValidationOwnerIds.length,
    }

    logger.info('Cron trust disclosures 완료', result)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Cron trust disclosures 오류', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
