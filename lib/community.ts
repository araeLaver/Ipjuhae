export type CommunityAudience = 'all' | 'tenant' | 'landlord' | 'broker'

export const COMMUNITY_AUDIENCES: CommunityAudience[] = ['all', 'tenant', 'landlord', 'broker']

export const AUDIENCE_LABELS: Record<CommunityAudience, string> = {
  all: '전체',
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
}

export function isCommunityAudience(value: unknown): value is CommunityAudience {
  return typeof value === 'string' && (COMMUNITY_AUDIENCES as string[]).includes(value)
}

/** The board that corresponds to a user's own role (null for admin/unknown). */
export function userTypeToAudience(userType: string | null | undefined): CommunityAudience | null {
  if (userType === 'tenant' || userType === 'landlord' || userType === 'broker') return userType
  return null
}

/** Audiences a user may READ: the shared board plus their own role's board. */
export function readableAudiences(userType: string | null | undefined): CommunityAudience[] {
  if (userType === 'admin') return [...COMMUNITY_AUDIENCES]
  const role = userTypeToAudience(userType)
  return role ? ['all', role] : ['all']
}

/** Whether a user may POST to a given board. */
export function canPostTo(userType: string | null | undefined, audience: CommunityAudience): boolean {
  if (userType === 'admin') return true
  const role = userTypeToAudience(userType)
  return audience === 'all' || audience === role
}
