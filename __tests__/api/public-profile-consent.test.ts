import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  generateToken: vi.fn(),
  setAuthCookie: vi.fn(),
}))

import { GET } from '@/app/api/profile/[id]/route'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

const ownerUserId = '00000000-0000-4000-8000-000000000001'
const viewerUserId = '00000000-0000-4000-8000-000000000002'
const profileId = '00000000-0000-4000-8000-000000000101'

function request() {
  return new Request(`http://localhost:3000/api/profile/${profileId}`, {
    headers: { 'user-agent': 'vitest' },
  })
}

describe('GET /api/profile/[id] consent contact masking', () => {
  const originalEnforceConsent = process.env.ENFORCE_PATENT_CONSENT

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENFORCE_PATENT_CONSENT = 'true'
  })

  afterEach(() => {
    process.env.ENFORCE_PATENT_CONSENT = originalEnforceConsent
  })

  it('canViewContact=true 동의가 있으면 공개 프로필 이름을 익명 처리하지 않아야 함', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: viewerUserId,
      user_type: 'landlord',
    } as any)

    vi.mocked(queryOne)
      .mockResolvedValueOnce({
        id: profileId,
        user_id: ownerUserId,
        name: '김민수',
        age_range: '30대',
        family_type: '1인',
        is_complete: true,
        trust_score: 0,
      } as any)
      .mockResolvedValueOnce(null)

    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'consent-1',
        owner_user_id: ownerUserId,
        viewer_user_id: viewerUserId,
        viewer_role: null,
        resource_type: 'profile',
        resource_id: profileId,
        allowed_fields: ['*'],
        allowed_purposes: ['profile_view'],
        can_view_contact: true,
      }])
      .mockResolvedValueOnce([{ id: 'log-1' }])

    const res = await GET(request(), {
      params: Promise.resolve({ id: profileId }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김민수')
  })
})
