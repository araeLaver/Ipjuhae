import { query } from '../lib/db'
import { calculateTrustScore, createEvidenceFact, trustDigest, type TrustSubjectType } from '../lib/trust-engine'
import { requireApprovedComplianceGate } from '../lib/compliance-gates'

interface LegacyVerification {
  user_id: string
  user_type: string
  employment_verified: boolean
  income_verified: boolean
  credit_verified: boolean
  employment_verified_at: Date | null
  income_verified_at: Date | null
  credit_verified_at: Date | null
}

interface LegacyReferenceCount {
  user_id: string
  count: string
}

async function run() {
  await requireApprovedComplianceGate('automated_scoring')

  const verifications = await query<LegacyVerification>(
    `SELECT verification.user_id, users.user_type,
            COALESCE(verification.employment_verified, FALSE) AS employment_verified,
            COALESCE(verification.income_verified, FALSE) AS income_verified,
            COALESCE(verification.credit_verified, FALSE) AS credit_verified,
            verification.employment_verified_at, verification.income_verified_at, verification.credit_verified_at
       FROM verifications verification
       JOIN users ON users.id = verification.user_id`
  )
  const references = await query<LegacyReferenceCount>(
    `SELECT user_id, COUNT(*)::text AS count
       FROM landlord_references
      WHERE status = 'completed'
      GROUP BY user_id`
  )

  let factsCreated = 0
  let scoresCalculated = 0
  for (const row of verifications) {
    const subjectType: TrustSubjectType = row.user_type === 'landlord' ? 'landlord' : 'tenant'
    const facts = [
      { field: 'employment_verified', verified: row.employment_verified, at: row.employment_verified_at },
      { field: 'income_verified', verified: row.income_verified, at: row.income_verified_at },
      { field: 'credit_verified', verified: row.credit_verified, at: row.credit_verified_at },
    ].filter((item) => item.verified)
    for (const fact of facts) {
      const result = await createEvidenceFact({
        subjectType,
        subjectId: row.user_id,
        sourceCode: 'legacy_profile',
        fieldName: fact.field,
        normalizedValue: true,
        objectHash: trustDigest({ legacy: 'verifications', userId: row.user_id, field: fact.field }),
        issuedAt: fact.at?.toISOString() ?? null,
        humanReviewed: false,
        reasonCodes: ['LEGACY_VERIFICATION_IMPORTED'],
      }, row.user_id)
      if (!('unchanged' in result)) factsCreated++
    }
    await calculateTrustScore(subjectType, row.user_id, null)
    scoresCalculated++
  }

  for (const reference of references) {
    const result = await createEvidenceFact({
      subjectType: 'tenant',
      subjectId: reference.user_id,
      sourceCode: 'legacy_profile',
      fieldName: 'legacy_reference_count',
      normalizedValue: Number(reference.count),
      objectHash: trustDigest({ legacy: 'reference_count', userId: reference.user_id, count: reference.count }),
      reasonCodes: ['LEGACY_REFERENCE_NOT_TRANSACTION_VERIFIED'],
    }, reference.user_id)
    if (!('unchanged' in result)) factsCreated++
  }

  console.log(JSON.stringify({ users: verifications.length, factsCreated, scoresCalculated, referenceCounts: references.length }))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
