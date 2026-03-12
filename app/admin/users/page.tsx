'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'

interface UserItem {
  id: string
  email: string
  name: string | null
  userType: string
  createdAt: string
  trustScore: number | null
  isComplete: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [userType, setUserType] = useState<'all' | 'tenant' | 'landlord'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchUsers = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (userType !== 'all') params.set('type', userType)
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (!reset && cursor) params.set('cursor', cursor)

    const res = await fetch(`/api/admin/users?${params}`)
    const data = await res.json() as { users: UserItem[]; nextCursor: string | null }

    setUsers(prev => reset ? data.users : [...prev, ...data.users])
    setCursor(data.nextCursor)
    setHasMore(!!data.nextCursor)
    setLoading(false)
  }, [userType, debouncedSearch, cursor])

  // Reset on filter change
  useEffect(() => {
    setCursor(null)
    fetchUsers(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, debouncedSearch])

  // Intersection observer for load more
  useEffect(() => {
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchUsers() },
      { threshold: 0.1 }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, fetchUsers])

  const typeLabel = (t: string) =>
    t === 'tenant' ? '세입자' : t === 'landlord' ? '집주인' : t === 'admin' ? '관리자' : t

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">회원 관리</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="이메일 또는 이름 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(['all', 'tenant', 'landlord'] as const).map(t => (
          <button
            key={t}
            onClick={() => setUserType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              userType === t
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'all' ? '전체' : typeLabel(t)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['이메일', '이름', '유형', '신뢰점수', '프로필', '가입일', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{u.email}</td>
                <td className="px-4 py-3 text-gray-600">{u.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.userType === 'tenant' ? 'bg-green-100 text-green-700' :
                    u.userType === 'landlord' ? 'bg-purple-100 text-purple-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {typeLabel(u.userType)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.trustScore ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.isComplete ? '완성' : '미완'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && (
          <div className="py-6 text-center text-sm text-gray-400">불러오는 중...</div>
        )}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  )
}
