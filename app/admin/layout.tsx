import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'

export const metadata = { title: '관리자 | 입주해' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user || user.user_type !== 'admin') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">입주해 관리자</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {[
            { href: '/admin', label: '대시보드' },
            { href: '/admin/users', label: '회원 관리' },
            { href: '/admin/documents', label: '서류 심사' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center px-3 py-2 rounded-lg text-sm text-gray-600
                         hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 truncate">{user.name ?? user.email}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
