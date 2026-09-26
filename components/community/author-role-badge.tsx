import { roleLabel } from '@/lib/community'

/**
 * 글쓴이 역할 배지 — **운영자만.**
 *
 * 목록(`community-board.tsx`)과 상세(`community-post-view.tsx`)가 같은 역할을 다르게
 * 보여주지 않도록 표기를 한 곳에 모은다. 목록도 이 컴포넌트를 쓴다(DOW-1236에서 합쳤다).
 *
 * 왜 일반 역할(임차인·임대인·중개사) 배지를 없앴나: 익명 게시판에서 역할 라벨은 글쓴이의
 * 신원 범위를 좁힌다. DOW-1176이 배지를 넣은 취지는 운영자 답을 눈에 걸리게 하는 것
 * 하나였고, 그건 운영자 배지만으로 그대로 성립한다. (DOW-1236 UX 판정)
 */
export function AuthorRoleBadge({ role }: { role: string | null | undefined }) {
  if (role !== 'admin') return null
  const label = roleLabel(role)
  if (!label) return null
  return <span className="rounded bg-primary px-1.5 py-0.5 font-medium text-primary-foreground">{label}</span>
}
