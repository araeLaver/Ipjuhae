import { describe, it, expect } from 'vitest'
import {
  getTenantProfileVisibility,
  isFieldVisible,
  normalizeConsentFields,
  getVisibleConsentFields,
  applyTenantProfileVisibility,
} from '@/lib/consent'
import type { DataConsent, ConsentStatus, Profile } from '@/types/database'

/**
 * DOW-1134 fail-closed 회귀 방어.
 *
 * 이전 구현은 `normalizeConsentFields(consent?.allowed_fields)`로 레코드의 status를
 * 확인하지 않고 allowed_fields를 그대로 읽었고, DEFAULT_CONSENT_FIELDS가
 * basic_profile / trust_score를 true로 채웠다. 그래서 (a) 레코드가 아예 없을 때와
 * (b) 레코드가 revoked / expired 상태일 때 모두 실명·신뢰점수가 노출됐다.
 *
 * route 레벨 테스트(__tests__/api/public-profile-consent.test.ts)는 (a)만 덮는다.
 * getTenantProfileConsent가 `status = 'active'`로 필터링하기 때문에 route를 통해서는
 * (b)를 재현할 수 없다. 그러나 getTenantProfileVisibility는 export된 공용 함수이므로
 * 여기서 직접 (b)를 고정해 둔다.
 */

const ALL_FIELDS_OPEN = {
  basic_profile: true,
  verification: true,
  bio: true,
  references: true,
  trust_score: true,
  contact: true,
}

function consentRecord(overrides: Partial<DataConsent> = {}): DataConsent {
  return {
    id: 'consent-1',
    user_id: 'tenant-1',
    target_role: 'landlord',
    purpose: 'tenant_profile_view',
    allowed_fields: { ...ALL_FIELDS_OPEN },
    consent_version: 1,
    status: 'active' as ConsentStatus,
    consented_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: null,
    revoked_at: null,
    revoke_reason: null,
    granted_by: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const ALL_MASKED = {
  basic_profile: false,
  verification: false,
  bio: false,
  references: false,
  trust_score: false,
  contact: false,
}

describe('getTenantProfileVisibility — fail-closed', () => {
  it('동의 레코드가 없으면 전부 마스킹한다', () => {
    expect(getTenantProfileVisibility(null)).toEqual(ALL_MASKED)
  })

  it('철회된(revoked) 레코드는 allowed_fields가 전부 열려 있어도 전부 마스킹한다', () => {
    const revoked = consentRecord({
      status: 'revoked' as ConsentStatus,
      revoked_at: new Date('2026-02-01T00:00:00Z'),
      revoke_reason: 'user_requested',
    })
    expect(getTenantProfileVisibility(revoked)).toEqual(ALL_MASKED)
  })

  it('만료된(expires_at 과거) 레코드는 status가 active여도 전부 마스킹한다', () => {
    const expired = consentRecord({ expires_at: new Date('2020-01-01T00:00:00Z') })
    expect(getTenantProfileVisibility(expired)).toEqual(ALL_MASKED)
  })

  it('활성 레코드는 allowed_fields에서 명시적으로 켠 항목만 공개한다', () => {
    const active = consentRecord({ allowed_fields: { basic_profile: true, bio: true } })
    expect(getTenantProfileVisibility(active)).toEqual({
      basic_profile: true,
      verification: false,
      bio: true,
      references: false,
      trust_score: false,
      contact: false,
    })
  })

  it('활성 레코드에서 누락된 키는 공개로 승격되지 않는다', () => {
    const active = consentRecord({ allowed_fields: {} })
    expect(getTenantProfileVisibility(active)).toEqual(ALL_MASKED)
  })
})

describe('normalizeConsentFields — 기본값이 전부 비공개', () => {
  it('입력이 없으면 전부 false다', () => {
    expect(normalizeConsentFields(null)).toEqual(ALL_MASKED)
    expect(normalizeConsentFields(undefined)).toEqual(ALL_MASKED)
    expect(normalizeConsentFields({})).toEqual(ALL_MASKED)
  })

  it('명시적으로 켠 항목만 true가 된다', () => {
    expect(normalizeConsentFields({ trust_score: true })).toEqual({
      ...ALL_MASKED,
      trust_score: true,
    })
  })
})

describe('isFieldVisible — 비활성 레코드 폴백', () => {
  it('레코드가 없으면 어떤 필드도 보이지 않는다', () => {
    for (const field of Object.keys(ALL_MASKED) as Array<keyof typeof ALL_MASKED>) {
      expect(isFieldVisible(null, field)).toBe(false)
    }
  })

  it('철회된 레코드면 allowed_fields가 열려 있어도 보이지 않는다', () => {
    const revoked = consentRecord({ status: 'revoked' as ConsentStatus })
    expect(isFieldVisible(revoked, 'basic_profile')).toBe(false)
    expect(isFieldVisible(revoked, 'trust_score')).toBe(false)
  })
})

describe('getVisibleConsentFields — 감사 로그에 basic_profile을 끼워넣지 않는다', () => {
  it('전부 마스킹이면 빈 배열이다', () => {
    // 이전 구현은 빈 배열일 때 ['basic_profile']을 돌려줘, 실제로는 마스킹된 조회가
    // 감사 로그에 "basic_profile을 봤다"로 기록됐다.
    expect(getVisibleConsentFields(ALL_MASKED)).toEqual([])
  })

  it('공개된 항목만 나열한다', () => {
    expect(getVisibleConsentFields({ ...ALL_MASKED, bio: true })).toEqual(['bio'])
  })
})

describe('applyTenantProfileVisibility — 본인은 예외', () => {
  const profile = {
    id: 'profile-1',
    user_id: 'tenant-1',
    name: '김민수',
    age_range: '30대',
    family_type: '1인',
    pets: ['cat'],
    smoking: false,
    stay_time: '저녁',
    duration: '2년',
    noise_level: '조용함',
    bio: '조용히 지냅니다',
    trust_score: 82,
    is_complete: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  } as unknown as Profile

  it('동의가 없는 제3자에게는 실명이 마스킹되고 신뢰점수가 0이 된다', () => {
    const out = applyTenantProfileVisibility(profile, ALL_MASKED, false)
    expect(out.name).toBe('김*수')
    expect(out.age_range).toBeNull()
    expect(out.family_type).toBeNull()
    expect(out.pets).toEqual([])
    expect(out.bio).toBeNull()
    expect(out.trust_score).toBe(0)
    expect(out.is_basic_profile_visible).toBe(false)
    expect(out.is_trust_score_visible).toBe(false)
  })

  it('본인 조회는 마스킹 대상이 아니다', () => {
    const out = applyTenantProfileVisibility(profile, ALL_MASKED, true)
    expect(out.name).toBe('김민수')
    expect(out.trust_score).toBe(82)
  })
})
