import { query } from '@/lib/db'

interface SummaryRow {
  total_users: string
  tenant_count: string
  landlord_count: string
  today_signups: string
  complete_profiles: string
  pending_docs: string
}

interface DailyRow {
  date: string
  count: string
}

async function getStats() {
  const [summary] = await query<SummaryRow>(`
    SELECT
      COUNT(*)                                                         AS total_users,
      COUNT(*) FILTER (WHERE user_type = 'tenant')                    AS tenant_count,
      COUNT(*) FILTER (WHERE user_type = 'landlord')                  AS landlord_count,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)         AS today_signups,
      (SELECT COUNT(*) FROM profiles WHERE is_complete = TRUE)         AS complete_profiles,
      (SELECT COUNT(*) FROM verification_documents WHERE status = 'pending') AS pending_docs
    FROM users
    WHERE user_type != 'admin'
  `)

  const daily = await query<DailyRow>(`
    SELECT DATE(created_at)::text AS date, COUNT(*)::text AS count
    FROM users
    WHERE created_at >= NOW() - INTERVAL '7 days' AND user_type != 'admin'
    GROUP BY DATE(created_at)
    ORDER BY date
  `)

  return { summary, daily }
}

export default async function AdminDashboard() {
  const { summary, daily } = await getStats()

  const cards = [
    { label: '전체 회원', value: summary?.total_users ?? '0', color: 'bg-blue-50 text-blue-700' },
    { label: '세입자', value: summary?.tenant_count ?? '0', color: 'bg-green-50 text-green-700' },
    { label: '집주인', value: summary?.landlord_count ?? '0', color: 'bg-purple-50 text-purple-700' },
    { label: '오늘 가입', value: summary?.today_signups ?? '0', color: 'bg-yellow-50 text-yellow-700' },
    { label: '프로필 완성', value: summary?.complete_profiles ?? '0', color: 'bg-indigo-50 text-indigo-700' },
    { label: '서류 대기', value: summary?.pending_docs ?? '0', color: 'bg-red-50 text-red-700' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl p-5 ${c.color}`}>
            <p className="text-sm font-medium opacity-70">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* 최근 7일 가입 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">최근 7일 신규 가입</h2>
        <div className="flex items-end gap-2 h-28">
          {daily.map(d => {
            const cnt = parseInt(d.count)
            const maxH = Math.max(...daily.map(r => parseInt(r.count)), 1)
            const pct = Math.round((cnt / maxH) * 100)
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{cnt}</span>
                <div
                  className="w-full bg-blue-400 rounded-t"
                  style={{ height: `${pct}%`, minHeight: cnt > 0 ? '4px' : '0' }}
                />
                <span className="text-[10px] text-gray-400">
                  {d.date.slice(5)}
                </span>
              </div>
            )
          })}
          {daily.length === 0 && (
            <p className="text-sm text-gray-400">데이터 없음</p>
          )}
        </div>
      </div>
    </div>
  )
}
