import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, Profile } from '@/types/database'
import { sendReferenceRequestSMS } from '@/lib/sms'
import { sendReferenceRequestEmail } from '@/lib/email'
import { referenceRequestSchema } from '@/lib/validations'
import crypto from 'crypto'
import { withIdempotency } from '@/lib/idempotency'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
    }

    const references = await query<LandlordReference>(
      `SELECT * FROM landlord_references WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    )

    return jsonSuccess(request, { references })
  } catch (error) {
    console.error('Get references error:', error)
    return jsonError(request, 500, 'Failed to load reference list', 'REFERENCE_LIST_FAILED')
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  const idempotencyKey = request.headers.get('idempotency-key')

  return withIdempotency({
    request,
    namespace: 'references.create',
    key: idempotencyKey,
    actorUserId: user.id,
    ttlMinutes: 120,
    handler: async () => {
      try {
        const body = await request.json()
        const parsed = referenceRequestSchema.safeParse(body)
        if (!parsed.success) {
          return jsonError(
            request,
            400,
            parsed.error.issues[0]?.message || 'Invalid request payload',
            'INVALID_PAYLOAD'
          )
        }

        const { landlordName, landlordPhone, landlordEmail } = parsed.data

        const existingRequest = await queryOne<LandlordReference>(
          `SELECT * FROM landlord_references
           WHERE user_id = $1 AND landlord_phone = $2 AND status IN ('pending', 'sent')`,
          [user.id, landlordPhone]
        )

        if (existingRequest) {
          return jsonError(request, 400, 'A reference request for this landlord is already pending', 'REFERENCE_ALREADY_REQUESTED')
        }

        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        const [reference] = await query<LandlordReference>(
          `INSERT INTO landlord_references
            (user_id, landlord_name, landlord_phone, landlord_email, verification_token, token_expires_at, status, request_sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())
           RETURNING *`,
          [user.id, landlordName, landlordPhone, landlordEmail, token, expiresAt]
        )

        const profile = await queryOne<Profile>(
          'SELECT name FROM profiles WHERE user_id = $1',
          [user.id]
        )

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const surveyUrl = `${baseUrl}/reference/survey/${token}`
        const tenantName = profile?.name || 'tenant'

        sendReferenceRequestSMS(landlordPhone, tenantName, surveyUrl)
        if (landlordEmail) {
          sendReferenceRequestEmail(landlordEmail, tenantName, surveyUrl).catch(() => {})
        }

        const response: Record<string, unknown> = {
          reference,
          message: 'Reference request created successfully.',
        }

        if (process.env.NODE_ENV !== 'production') {
          response.surveyUrl = surveyUrl
        }

        return jsonSuccess(request, response, 201)
      } catch (error) {
        console.error('Create reference error:', error)
        return jsonError(request, 500, 'Failed to create reference request', 'REFERENCE_CREATE_FAILED')
      }
    },
  })
}
