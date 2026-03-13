import { query } from '@/lib/db'

interface EventRow {
  event_name: string
  count: string
  last_seen: string
}

async function getEventStats(): Promise<EventRow[]> {
  try {
    return await query<EventRow>(`
      SELECT
        event_name,
        COUNT(*)::text AS count,
        MAX(created_at)::text AS last_seen
      FROM analytics_events
      GROUP BY event_name
      ORDER BY COUNT(*) DESC
    `)
  } catch (err) {
    console.error('[admin/analytics] failed to query analytics_events', err)
    return []
  }
}

export default async function AdminAnalyticsPage() {
  const events = await getEventStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이벤트 분석</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium">아직 수집된 이벤트가 없습니다</p>
            <p className="text-sm mt-1">사용자 활동이 발생하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">이벤트명</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">횟수</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">마지막 발생</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((row) => (
                <tr key={row.event_name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-800">{row.event_name}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-700">
                    {parseInt(row.count).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 text-xs">
                    {new Date(row.last_seen).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
