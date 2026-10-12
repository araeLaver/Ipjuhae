import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'

export const metadata = { title: '관리자 | 입주해' }

const adminNav = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/operations', label: '서비스 운영·수익' },
  { href: '/admin/community', label: '질문 답변 운영' },
  { href: '/admin/analytics', label: '사용자 활성화' },
  { href: '/admin/users', label: '사용자' },
  { href: '/admin/documents', label: '문서' },
  { href: '/admin/patents', label: '특허 문서' },
  { href: '/admin/disputes', label: '이의 제기' },
  { href: '/admin/access-logs', label: '접근 로그' },
  { href: '/admin/trust', label: 'Trust 엔진' },
  { href: '/admin/trust/operations', label: 'Trust 운영' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user || user.user_type !== 'admin') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/50 md:flex-row">
      <aside className="w-full shrink-0 bg-white border-b border-gray-200 flex flex-col md:w-56 md:border-b-0 md:border-r">
        <div className="h-14 flex items-center px-5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">관리자</span>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:flex-1 md:space-y-1 md:py-4"
          aria-label="관리자 메뉴"
        >
          {adminNav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center whitespace-nowrap px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-muted hover:text-gray-900 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden p-4 border-t border-gray-200 md:block">
          <p className="text-xs text-gray-400 truncate">
            {user.name ?? user.email}
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
