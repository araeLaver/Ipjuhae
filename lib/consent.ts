import { query, queryOne } from '@/lib/db'
import { DataConsent, ConsentPurpose, ConsentTargetRole } from '@/types/database'
import { Profile } from '@/types/database'

const DEFAULT_CONSENT_FIELDS = {
  basic_profile: true,
  verification: false,
  bio: false,
  references: false,
  trust_score: true,
  contact: false,
}

export type ConsentField = keyof typeof DEFAULT_CONSENT_FIELDS

export interface NormalizedConsentFields extends Record<string, boolean> {
  basic_profile: boolean
  verification: boolean
  bio: boolean
  references: boolean
  trust_score: boolean
  contact: boolean
}

export function normalizeConsentFields(raw: unknown): NormalizedConsentFields {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    basic_profile: Boolean(source.basic_profile ?? DEFAULT_CONSENT_FIELDS.basic_profile),
    verification: Boolean(source.verification ?? DEFAULT_CONSENT_FIELDS.verification),
    bio: Boolean(source.bio ?? DEFAULT_CONSENT_FIELDS.bio),
    references: Boolean(source.references ?? DEFAULT_CONSENT_FIELDS.references),
    trust_score: Boolean(source.trust_score ?? DEFAULT_CONSENT_FIELDS.trust_score),
    contact: Boolean(source.contact ?? DEFAULT_CONSENT_FIELDS.contact),
  }
}

export async function getActiveConsent(
  userId: string,
  targetRole: ConsentTargetRole,
  purpose: ConsentPurpose,
): Promise<DataConsent | null> {
  const consent = await queryOne<DataConsent>(
    `SELECT *
     FROM data_consents
     WHERE user_id = $1
       AND target_role = $2
       AND purpose = $3
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY consent_version DESC
     LIMIT 1`,
    [userId, targetRole, purpose]
  )

  return consent || null
}

export function isConsentActive(consent: DataConsent | null | undefined): consent is DataConsent {
  if (!consent) return false
  return consent.status === 'active' && (consent.expires_at === null || new Date(consent.expires_at) > new Date())
}

export function isFieldVisible(
  consent: DataConsent | null,
  field: ConsentField
): boolean {
  if (!isConsentActive(consent)) {
    return DEFAULT_CONSENT_FIELDS[field]
  }
  const fields = normalizeConsentFields(consent.allowed_fields)
  return fields[field]
}

export async function getTenantProfileConsent(userId: string): Promise<DataConsent | null> {
  return getActiveConsent(userId, 'landlord', 'tenant_profile_view')
}

export async function getLandlordProfileConsent(userId: string): Promise<DataConsent | null> {
  return getActiveConsent(userId, 'tenant', 'landlord_profile_view')
}

export interface TenantProfileFieldVisibility {
  basic_profile: boolean
  verification: boolean
  bio: boolean
  references: boolean
  trust_score: boolean
  contact: boolean
}

export function getTenantProfileVisibility(
  consent: DataConsent | null
): TenantProfileFieldVisibility {
  const fields = normalizeConsentFields(consent?.allowed_fields)
  return {
    basic_profile: fields.basic_profile,
    verification: fields.verification,
    bio: fields.bio,
    references: fields.references,
    trust_score: fields.trust_score,
    contact: fields.contact,
  }
}

export function maskProfileName(name: string | null): string | null {
  if (!name || name.length < 2) return name
  if (name.length === 2) return `${name[0]}*`
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`
}

type TenantProfileExposure = Pick<
  Profile,
  'id' | 'user_id' | 'is_complete' | 'created_at' | 'updated_at'
> & {
  name: string | null
  age_range: string | null
  family_type: string | null
  pets: string[] | null
  smoking: boolean | null
  stay_time: string | null
  duration: string | null
  noise_level: string | null
  bio: string | null
  trust_score: number
  is_basic_profile_visible: boolean
  is_verification_visible: boolean
  is_bio_visible: boolean
  is_references_visible: boolean
  is_trust_score_visible: boolean
  is_contact_visible: boolean
}

export function applyTenantProfileVisibility(
  profile: Profile,
  visibility: TenantProfileFieldVisibility,
  isOwner = false
): TenantProfileExposure {
  const canSeeBasic = isOwner || visibility.basic_profile
  const canSeeVerification = isOwner || visibility.verification
  const canSeeBio = isOwner || visibility.bio
  const canSeeReferences = isOwner || visibility.references
  const canSeeTrust = isOwner || visibility.trust_score
  const canSeeContact = isOwner || visibility.contact

  return {
    id: profile.id,
    user_id: profile.user_id,
    is_complete: profile.is_complete,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    name: canSeeBasic ? profile.name : maskProfileName(profile.name),
    age_range: canSeeBasic ? profile.age_range : null,
    family_type: canSeeBasic ? profile.family_type : null,
    pets: canSeeBasic ? profile.pets : [],
    smoking: canSeeBasic ? profile.smoking : false,
    stay_time: canSeeBasic ? profile.stay_time : null,
    duration: canSeeBasic ? profile.duration : null,
    noise_level: canSeeBasic ? profile.noise_level : null,
    bio: canSeeBio ? profile.bio : null,
    trust_score: canSeeTrust ? profile.trust_score : 0,
    is_basic_profile_visible: canSeeBasic,
    is_verification_visible: canSeeVerification,
    is_bio_visible: canSeeBio,
    is_references_visible: canSeeReferences,
    is_trust_score_visible: canSeeTrust,
    is_contact_visible: canSeeContact,
  } as TenantProfileExposure
}

export function getVisibleConsentFields(visibility: TenantProfileFieldVisibility): string[] {
  const entries = Object.entries(visibility).filter(([, value]) => value).map(([field]) => field)
  return entries.length > 0 ? entries : ['basic_profile']
}

export function toConsentRole(userType: string | null | undefined): ConsentTargetRole | null {
  if (userType === 'tenant' || userType === 'landlord' || userType === 'broker' || userType === 'admin') {
    return userType
  }
  return null
}
