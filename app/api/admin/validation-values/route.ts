import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { ValidationValue } from '@/types/database'

const REVIEW_STATUSES = ['extracted', 'needs_review', 'confirmed', 'rejected', 'corrected', 'expired', 'disputed'] as const
const VALUE_STATUSES = ['valid', 'needs_review', 'disputed', 'stale'] as const
const SOURCE_TYPES = ['legacy', 'ocr', 'manual', 'external_api', 'reference', 'system'] as const
const SUBJECT_TYPES = ['tenant', 'landlord', 'property', 'reference'] as const

interface ValidationValueReviewRow extends ValidationValue {
  owner_email: string
  owner_name: string | null
  evidence_file_name: string | null
  evidence_document_type: string | null
  evidence_extraction_status: string | null
}

function normalizeListParam<T extends readonly string[]>(
  value: string | null,
  allowed: T,
  fallback: T[number] | 'all',
): T[number] | 'all' {
  if (!value) return fallback
  return allowed.includes(value as T[number]) ? value as T[number] : fallback
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '30', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 30
  return Math.min(parsed, 100)
}

function buildFilters(searchParams: URLSearchParams, includeReviewStatus: boolean) {
  const reviewStatus = normalizeListParam(searchParams.get('reviewStatus'), REVIEW_STATUSES, 'needs_review')
  const status = normalizeListParam(searchParams.get('status'), VALUE_STATUSES, 'all')
  const sourceType = normalizeListParam(searchParams.get('sourceType'), SOURCE_TYPES, 'all')
  const subjectType = normalizeListParam(searchParams.get('subjectType'), SUBJECT_TYPES, 'all')
  const ownerUserId = searchParams.get('ownerUserId')?.trim()
  const q = searchParams.get('q')?.trim()

  const conditions: string[] = ['1=1']
  const params: unknown[] = []

  if (includeReviewStatus && reviewStatus !== 'all') {
    params.push(reviewStatus)
    conditions.push(`COALESCE(vv.review_status, 'needs_review') = $${params.length}`)
  }

  if (status !== 'all') {
    params.push(status)
    conditions.push(`vv.status = $${params.length}`)
  }

  if (sourceType !== 'all') {
    params.push(sourceType)
    conditions.push(`COALESCE(vv.source_type, 'legacy') = $${params.length}`)
  }

  if (subjectType !== 'all') {
    params.push(subjectType)
    conditions.push(`vv.subject_type = $${params.length}`)
  }

  if (ownerUserId) {
    params.push(ownerUserId)
    conditions.push(`vv.owner_user_id = $${params.length}::uuid`)
  }

  if (q) {
    params.push(`%${q}%`)
    const idx = params.length
    conditions.push(`(
      vv.validation_key ILIKE $${idx}
      OR COALESCE(vv.source_authority, '') ILIKE $${idx}
      OR COALESCE(vv.source_comment, '') ILIKE $${idx}
      OR u.email ILIKE $${idx}
      OR COALESCE(u.name, '') ILIKE $${idx}
    )`)
  }

  return { conditions, params }
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit = parseLimit(searchParams.get('limit'))
  const cursor = searchParams.get('cursor')

  const listFilters = buildFilters(searchParams, true)
  if (cursor) {
    listFilters.params.push(cursor, cursor)
    const createdAtIdx = listFilters.params.length - 1
    const idIdx = listFilters.params.length
    listFilters.conditions.push(`(
      vv.created_at < (SELECT created_at FROM validation_values WHERE id = $${createdAtIdx}::uuid)
      OR (
        vv.created_at = (SELECT created_at FROM validation_values WHERE id = $${createdAtIdx}::uuid)
        AND vv.id < $${idIdx}::uuid
      )
    )`)
  }

  const whereClause = `WHERE ${listFilters.conditions.join(' AND ')}`
  const listParams = [...listFilters.params, limit + 1]

  const rows = await query<ValidationValueReviewRow>(`
    SELECT
      vv.*,
      u.email AS owner_email,
      u.name AS owner_name,
      er.file_name AS evidence_file_name,
      er.document_type AS evidence_document_type,
      er.extraction_status AS evidence_extraction_status
    FROM validation_values vv
    JOIN users u ON u.id = vv.owner_user_id
    LEFT JOIN evidence_records er ON er.id = vv.source_evidence_id
    ${whereClause}
    ORDER BY vv.created_at DESC, vv.id DESC
    LIMIT $${listParams.length}
  `, listParams)

  const countFilters = buildFilters(searchParams, false)
  const countWhereClause = `WHERE ${countFilters.conditions.join(' AND ')}`
  const counts = await queryOne<{
    extracted: string
    needs_review: string
    confirmed: string
    rejected: string
    corrected: string
    expired: string
    disputed: string
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'extracted')::text AS extracted,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'needs_review')::text AS needs_review,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'confirmed')::text AS confirmed,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'rejected')::text AS rejected,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'corrected')::text AS corrected,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'expired')::text AS expired,
      COUNT(*) FILTER (WHERE COALESCE(vv.review_status, 'needs_review') = 'disputed')::text AS disputed
    FROM validation_values vv
    JOIN users u ON u.id = vv.owner_user_id
    LEFT JOIN evidence_records er ON er.id = vv.source_evidence_id
    ${countWhereClause}
  `, countFilters.params)

  const hasMore = rows.length > limit
  const validationValues = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    validationValues,
    nextCursor: hasMore ? validationValues[validationValues.length - 1].id : null,
    counts: {
      extracted: Number(counts?.extracted ?? 0),
      needsReview: Number(counts?.needs_review ?? 0),
      confirmed: Number(counts?.confirmed ?? 0),
      rejected: Number(counts?.rejected ?? 0),
      corrected: Number(counts?.corrected ?? 0),
      expired: Number(counts?.expired ?? 0),
      disputed: Number(counts?.disputed ?? 0),
    },
  })
}
