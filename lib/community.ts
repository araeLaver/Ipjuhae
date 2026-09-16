export type CommunityAudience = 'all' | 'tenant' | 'landlord' | 'broker'

export const COMMUNITY_AUDIENCES: CommunityAudience[] = ['all', 'tenant', 'landlord', 'broker']

export const AUDIENCE_LABELS: Record<CommunityAudience, string> = {
  all: '전체',
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
}

/**
 * 글쓴이 계정의 역할 표시.
 *
 * 게시판을 역할별로 쪼개지 않고 한 곳에서 운영하기 때문에, 누가 쓴 글인지는
 * 이 배지로 구분한다. 게시판 라벨(AUDIENCE_LABELS)이 "어느 판에 올렸나"라면
 * 이건 "누가 썼나"다.
 */
export const ROLE_LABELS: Record<string, string> = {
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
  admin: '운영자',
}

export function roleLabel(userType: string | null | undefined): string | null {
  return userType ? (ROLE_LABELS[userType] ?? null) : null
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
