import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
  logAdminAction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/trust-score-recalculator', () => ({
  recalculateTrustScoreForUser: vi.fn(),
}))

import { GET } from '@/app/api/admin/validation-values/route'
import { PATCH } from '@/app/api/admin/validation-values/[id]/route'
import { getAdminUser, logAdminAction } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { recalculateTrustScoreForUser } from '@/lib/trust-score-recalculator'

const adminUser = {
  id: '00000000-0000-4000-8000-000000000099',
  email: 'admin@rentme.test',
  name: 'Admin',
  user_type: 'admin',
}

const baseValidationValue = {
  id: '00000000-0000-4000-8000-000000000001',
  owner_user_id: '00000000-0000-4000-8000-000000000011',
  subject_type: 'tenant',
  subject_id: '00000000-0000-4000-8000-000000000011',
  validation_key: 'income_ocr_text_length',
  validation_score: null,
  validation_numeric: '120',
  validation_text: null,
  validation_flag: 'ocr_text_present',
  status: 'needs_review',
  source_evidence_id: null,
  source_comment: 'OCR 후보값',
  source_type: 'ocr',
  source_authority: 'ai-omakase',
  issued_at: null,
  observed_at: new Date('2026-07-26T00:00:00.000Z'),
  confidence: null,
  review_status: 'needs_review',
  reason_codes: ['OCR_CANDIDATE_REQUIRES_HUMAN_REVIEW'],
  consent_id: null,
  valid_until: null,
  retention_until: null,
  model_version: 'ai-omakase:image-to-text',
  reviewed_at: null,
  reviewed_by: null,
  metadata: {},
  created_at: new Date('2026-07-26T00:00:00.000Z'),
  updated_at: new Date('2026-07-26T00:00:00.000Z'),
}

function request(url: string, body?: Record<string, unknown>) {
  return new Request(url, {
    method: body ? 'PATCH' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/validation-values', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('관리자 권한이 없으면 검수 큐를 조회하지 않는다', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)

    const res = await GET(request('http://localhost:3000/api/admin/validation-values') as any)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain('관리자 권한')
    expect(query).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('기본값으로 needs_review 검수 큐를 반환한다', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(adminUser as never)
    vi.mocked(query).mockResolvedValue([
      {
        ...baseValidationValue,
        owner_email: 'tenant@rentme.test',
        owner_name: 'Tenant',
        evidence_file_name: 'income.pdf',
        evidence_document_type: 'income',
        evidence_extraction_status: 'ocr_complete',
      },
    ])
    vi.mocked(queryOne).mockResolvedValue({
      extracted: '0',
      needs_review: '1',
      confirmed: '0',
      rejected: '0',
      corrected: '0',
      expired: '0',
      disputed: '0',
    })

    const res = await GET(request('http://localhost:3000/api/admin/validation-values?limit=1') as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.validationValues).toHaveLength(1)
    expect(data.counts.needsReview).toBe(1)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM validation_values vv'), ['needs_review', 2])
  })
})

describe('PATCH /api/admin/validation-values/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(adminUser as never)
    vi.mocked(logAdminAction).mockResolvedValue(undefined)
    vi.mocked(recalculateTrustScoreForUser).mockResolvedValue(null)
  })

  it('반려는 사유 없이 처리하지 않는다', async () => {
    const res = await PATCH(
      request('http://localhost:3000/api/admin/validation-values/00000000-0000-4000-8000-000000000001', {
        action: 'reject',
      }) as any,
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) },
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('반려 사유')
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('승인 시 valid/confirmed로 전환하고 감사 로그와 재계산을 실행한다', async () => {
    vi.mocked(queryOne).mockResolvedValue(baseValidationValue)
    vi.mocked(query).mockResolvedValue([
      {
        ...baseValidationValue,
        status: 'valid',
        review_status: 'confirmed',
        validation_score: 5,
        reason_codes: ['OCR_CONFIRMED'],
        reviewed_by: adminUser.id,
      },
    ])

    const res = await PATCH(
      request('http://localhost:3000/api/admin/validation-values/00000000-0000-4000-8000-000000000001', {
        action: 'confirm',
        validationScore: 5,
        reasonCodes: ['ocr_confirmed'],
        reviewComment: '가상 증빙 기준 확인',
      }) as any,
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) },
    )
    const data = await res.json()
    const updateParams = vi.mocked(query).mock.calls[0][1] as unknown[]

    expect(res.status).toBe(200)
    expect(data.validationValue).toMatchObject({ status: 'valid', review_status: 'confirmed' })
    expect(updateParams).toEqual(expect.arrayContaining(['valid', 'confirmed', 5, ['OCR_CONFIRMED'], adminUser.id]))
    expect(logAdminAction).toHaveBeenCalledWith(
      adminUser.id,
      'confirm_validation_value',
      'validation_value',
      baseValidationValue.id,
      expect.objectContaining({
        owner_user_id: baseValidationValue.owner_user_id,
        review_status: 'confirmed',
      }),
    )
    expect(recalculateTrustScoreForUser).toHaveBeenCalledWith(baseValidationValue.owner_user_id)
  })

  it('숫자 필드가 잘못되면 업데이트하지 않는다', async () => {
    vi.mocked(queryOne).mockResolvedValue(baseValidationValue)

    const res = await PATCH(
      request('http://localhost:3000/api/admin/validation-values/00000000-0000-4000-8000-000000000001', {
        action: 'confirm',
        validationNumeric: 'not-a-number',
      }) as any,
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) },
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('validationNumeric')
    expect(query).not.toHaveBeenCalled()
  })
})
