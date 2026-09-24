import { roleLabel } from '@/lib/community'

/**
 * 글쓴이 역할 배지.
 *
 * 목록(`community-board.tsx`)과 상세(`community-post-view.tsx`)가 같은 역할을 다르게
 * 보여주지 않도록 표기를 한 곳에 모은다. 라벨은 `roleLabel`, 강조색은 운영자만.
 *
 * 목록 화면은 지금 DOW-1136이 같은 파일을 고치는 중이라 이번 변경에서 건드리지 않았다.
 * 클래스는 목록 쪽 인라인 마크업과 글자 단위로 동일하게 맞췄고, DOW-1136이 머지된 뒤
 * 목록도 이 컴포넌트를 쓰도록 바꾸면 중복이 사라진다.
 */
export function AuthorRoleBadge({ role }: { role: string | null | undefined }) {
  const label = roleLabel(role)
  if (!label) return null
  return (
    <span
      className={
        'rounded px-1.5 py-0.5 font-medium ' +
        (role === 'admin' ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground/70')
      }
    >
      {label}
    </span>
  )
}
