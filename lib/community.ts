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
import { ROLE_LABELS } from './roles';
export { ROLE_LABELS };

export function roleLabel(userType: string | null | undefined): string | null {
  return userType ? ((ROLE_LABELS as Record<string, string>)[userType] ?? null) : null
}

/** 운영자 글·댓글에 붙는 표시 이름. DB 이름이 아니라 역할에서 나온다. */
export const ADMIN_DISPLAY_NAME = '입주해 운영자'
/** 그 외 전부. 커뮤니티는 익명 게시판이다. */
export const ANONYMOUS_DISPLAY_NAME = '익명'

/**
 * 글쓴이 표시 이름.
 *
 * **계정 이름을 쓰지 않는다.** 커뮤니티는 익명 게시판이고 닉네임 필드가 없어서, 표시에
 * 쓸 수 있는 이름은 `profiles.name`(임차인 검증용 실명)뿐이다. 그래서 서버가 이름을
 * 아예 내려보내지 않고(DOW-1236), 표시 이름은 역할 하나에서 만든다.
 *
 * 운영자만 예외다 — 공식 답변 자리가 '익명'으로 찍히면 그것도 사실과 다르다.
 * 닉네임 체계를 도입하면 이 함수 한 곳만 바꾸면 된다.
 */
export function authorDisplayName(role: string | null | undefined): string {
  return role === 'admin' ? ADMIN_DISPLAY_NAME : ANONYMOUS_DISPLAY_NAME
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

/**
 * 글이 올라갈 기본 게시판. **지금 보고 있는 탭**을 따른다.
 *
 * 임대인 탭을 읽다가 글쓰기를 누르면 임대인 게시판에 올라가야 한다.
 * 탭이 `all`일 때만 로그인 사용자는 본인 역할 게시판, 비로그인은 `all`.
 *
 * 웹 화면 안에 있던 규칙을 여기로 올렸다. 앱도 같은 판정을 써야 하는데
 * (DOW-1196), 화면 컴포넌트 안에 있으면 앱이 참조할 수도, 갈라졌는지
 * 확인할 수도 없다.
 */
export function defaultAudienceFor(
  currentTab: CommunityAudience,
  userType: string | null | undefined,
): CommunityAudience {
  return currentTab === 'all' ? (userTypeToAudience(userType) ?? 'all') : currentTab
}
