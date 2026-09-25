/**
 * 커뮤니티 게시판 규칙 — 웹 `lib/community.ts`와 같은 판정.
 *
 * 왜 import 하지 않고 옮겨 적었나: 앱은 Expo/Metro가 `mobile/`을 루트로 묶어서
 * 저장소 루트의 `lib/`을 번들에 넣으려면 watchFolders 설정이 필요하다. 그 설정은
 * 앱 빌드 전반에 영향이 가는데, 이 파일은 의존성 없는 순수 함수 몇 개뿐이라
 * 옮겨 적는 쪽이 위험이 작다.
 *
 * 대신 **갈라지면 실패하는 테스트**를 붙였다(`__tests__/mobile/community-rules-parity.test.ts`).
 * 웹 원본과 이 파일을 둘 다 import해서 역할×게시판 전 조합의 판정이 같은지 본다.
 * 한쪽만 고치면 그 테스트가 깨진다.
 */

export type CommunityAudience = 'all' | 'tenant' | 'landlord' | 'broker';

export const COMMUNITY_AUDIENCES: CommunityAudience[] = ['all', 'tenant', 'landlord', 'broker'];

export const AUDIENCE_LABELS: Record<CommunityAudience, string> = {
  all: '전체',
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
};

/**
 * 글쓴이 계정의 역할 표시.
 *
 * 게시판 라벨(AUDIENCE_LABELS)이 "어느 판에 올렸나"라면 이건 "누가 썼나"다.
 */
export const ROLE_LABELS: Record<string, string> = {
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
  admin: '운영자',
};

export function isCommunityAudience(value: unknown): value is CommunityAudience {
  return typeof value === 'string' && (COMMUNITY_AUDIENCES as string[]).includes(value);
}

/** 그 계정의 역할에 해당하는 게시판 (admin·미상은 null). */
export function userTypeToAudience(userType: string | null | undefined): CommunityAudience | null {
  if (userType === 'tenant' || userType === 'landlord' || userType === 'broker') return userType;
  return null;
}

/** 읽을 수 있는 게시판: 공용 판 + 본인 역할 판. */
export function readableAudiences(userType: string | null | undefined): CommunityAudience[] {
  if (userType === 'admin') return [...COMMUNITY_AUDIENCES];
  const role = userTypeToAudience(userType);
  return role ? ['all', role] : ['all'];
}

/** 그 게시판에 글을 쓸 수 있는가. */
export function canPostTo(userType: string | null | undefined, audience: CommunityAudience): boolean {
  if (userType === 'admin') return true;
  const role = userTypeToAudience(userType);
  return audience === 'all' || audience === role;
}

/**
 * 글이 올라갈 기본 게시판. **지금 보고 있는 탭**을 따른다.
 *
 * 임대인 탭을 읽다가 글쓰기를 누르면 임대인 게시판에 올라가야 한다.
 * 탭이 `all`일 때만 로그인 사용자는 본인 역할 게시판, 비로그인은 `all`.
 * (DOW-1136 확정 규칙 — 웹 `community-board.tsx`의 `defaultAudienceFor`와 같다.)
 */
export function defaultAudienceFor(
  currentTab: CommunityAudience,
  userType: string | null | undefined
): CommunityAudience {
  return currentTab === 'all' ? (userTypeToAudience(userType) ?? 'all') : currentTab;
}
