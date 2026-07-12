import { transaction } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { consentRevokeSchema, consentUpsertSchema } from '@/lib/validations'
import { normalizeConsentFields } from '@/lib/consent'
import { DataConsent, ConsentPurpose, ConsentTargetRole } from '@/types/database'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { queryOne, query } from '@/lib/db'
import { withIdempotency } from '@/lib/idempotency'

function sanitizeRoleAndPurpose(payload: {
  targetRole: string
  purpose: string
}): { targetRole: ConsentTargetRole; purpose: ConsentPurpose } | null {
  const isRole = (value: string): value is ConsentTargetRole =>
    value === 'tenant' ||
    value === 'landlord' ||
    value === 'broker' ||
    value === 'admin'
  const isPurpose = (value: string): value is ConsentPurpose =>
    value === 'tenant_profile_view' ||
    value === 'landlord_profile_view' ||
    value === 'property_view'

  if (!isRole(payload.targetRole) || !isPurpose(payload.purpose)) {
    return null
  }

  return {
    targetRole: payload.targetRole,
    purpose: payload.purpose,
  }
}

function parseDateWindow(expiresInDays?: number): Date | null {
  if (!expiresInDays || !Number.isInteger(expiresInDays) || expiresInDays <= 0) {
    return null
  }
  const date = new Date()
  date.setDate(date.getDate() + expiresInDays)
  return date
}

function buildAllowedFields(input: unknown) {
  const normalized = normalizeConsentFields(input)
  return {
    basic_profile: Boolean(normalized.basic_profile),
    verification: Boolean(normalized.verification),
    bio: Boolean(normalized.bio),
    references: Boolean(normalized.references),
    trust_score: Boolean(normalized.trust_score),
    contact: Boolean(normalized.contact),
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
    }

    const consents = await query<DataConsent>(
      `SELECT *
         FROM data_consents
        WHERE user_id = $1
        ORDER BY target_role ASC, purpose ASC, consent_version DESC`,
      [user.id]
    )

    return jsonSuccess(request, { consents })
  } catch (error) {
    console.error('Get consent error:', error)
    return jsonError(request, 500, 'Failed to load consents', 'CONSENT_LIST_FAILED')
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  const idempotencyKey = request.headers.get('idempotency-key')

  try {
    const body = await request.json()
    const parsed = consentUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const normalizedPair = sanitizeRoleAndPurpose(parsed.data)
    if (!normalizedPair) {
      return jsonError(request, 400, 'Invalid targetRole or purpose', 'INVALID_PAYLOAD')
    }

    const allowedFields = buildAllowedFields(parsed.data.allowedFields)
    const expiresAt = parseDateWindow(parsed.data.expiresInDays)

    const response = await withIdempotency({
      request,
      namespace: 'consent.upsert',
      key: idempotencyKey,
      actorUserId: user.id,
      ttlMinutes: 120,
      handler: async () => {
        const consent = await transaction(async (client) => {
          const latestResult = await client.query<DataConsent>(
            `SELECT *
             FROM data_consents
             WHERE user_id = $1 AND target_role = $2 AND purpose = $3
             ORDER BY consent_version DESC
             LIMIT 1`,
            [user.id, normalizedPair.targetRole, normalizedPair.purpose]
          )

          const latest = latestResult.rows[0] || null
          const nextVersion = latest ? latest.consent_version + 1 : 1

          if (latest && latest.status === 'active') {
            await client.query(
              `UPDATE data_consents
                 SET status = 'revoked',
                     revoked_at = NOW(),
                     revoke_reason = 'superseded'
               WHERE id = $1`,
              [latest.id]
            )
          }

          const inserted = await client.query<DataConsent>(
            `INSERT INTO data_consents
             (user_id, target_role, purpose, allowed_fields, consent_version, status, expires_at, granted_by)
             VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
             RETURNING *`,
            [
              user.id,
              normalizedPair.targetRole,
              normalizedPair.purpose,
              allowedFields,
              nextVersion,
              expiresAt,
              user.id,
            ]
          )

          const current = inserted.rows[0]

          await client.query(
            `INSERT INTO consent_events
             (data_consent_id, user_id, target_role, purpose, event_type, from_payload, to_payload, reason, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              current.id,
              user.id,
              normalizedPair.targetRole,
              normalizedPair.purpose,
              latest ? 'updated' : 'granted',
              latest?.allowed_fields ?? null,
              current.allowed_fields,
              null,
              user.id,
            ]
          )

          return current
        })

        return jsonSuccess(request, { consent }, 201)
      },
    })

    return response
  } catch (error) {
    console.error('Set consent error:', error)
    return jsonError(request, 500, 'Failed to save consent', 'CONSENT_UPDATE_FAILED')
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  const idempotencyKey = request.headers.get('idempotency-key')

  try {
    const body = await request.json()
    const parsed = consentRevokeSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const normalizedPair = sanitizeRoleAndPurpose(parsed.data)
    if (!normalizedPair) {
      return jsonError(request, 400, 'Invalid targetRole or purpose', 'INVALID_PAYLOAD')
    }

    const response = await withIdempotency({
      request,
      namespace: 'consent.revoke',
      key: idempotencyKey,
      actorUserId: user.id,
      ttlMinutes: 120,
      handler: async () => {
        const revoked = await queryOne<DataConsent>(
          `SELECT *
           FROM data_consents
           WHERE user_id = $1
             AND target_role = $2
             AND purpose = $3
             AND status = 'active'
           ORDER BY consent_version DESC
           LIMIT 1`,
          [user.id, normalizedPair.targetRole, normalizedPair.purpose]
        )

        if (!revoked) {
          return jsonError(request, 404, 'No active consent to revoke', 'CONSENT_NOT_FOUND')
        }

        await query(
          `UPDATE data_consents
           SET status = 'revoked',
               revoked_at = NOW(),
               revoke_reason = $2
           WHERE id = $1`,
          [revoked.id, parsed.data.reason ?? 'User requested withdrawal']
        )

        await query(
          `INSERT INTO consent_events
           (data_consent_id, user_id, target_role, purpose, event_type, from_payload, reason, created_by)
           VALUES ($1, $2, $3, $4, 'revoked', $5, $6, $7)`,
          [
            revoked.id,
            user.id,
            normalizedPair.targetRole,
            normalizedPair.purpose,
            revoked.allowed_fields,
            parsed.data.reason ?? null,
            user.id,
          ]
        )

        return jsonSuccess(request, {
          consent: {
            ...revoked,
            status: 'revoked',
          },
          message: 'Consent withdrawn successfully',
        })
      },
    })

    return response
  } catch (error) {
    console.error('Revoke consent error:', error)
    return jsonError(request, 500, 'Failed to revoke consent', 'CONSENT_REVOKE_FAILED')
  }
}
