import { logger } from '@/lib/logger'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface EventRow {
  event_name: string
  count: string
  last_seen: string
}

/** /check 결과 → 테스터 배너 노출 → 클릭. 한 행에서 전환이 읽히도록 3열로 만든다. */
interface FunnelRow {
  day: string
  result_viewed: string
  invite_shown: string
  invite_clicked: string
}

async function getTesterFunnel(): Promise<FunnelRow[]> {
  try {
    return await query<FunnelRow>(`
      SELECT
        TO_CHAR(DATE(created_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE event_name = 'check_result_viewed')::text AS result_viewed,
        COUNT(*) FILTER (WHERE event_name = 'tester_invite_shown')::text AS invite_shown,
        COUNT(*) FILTER (WHERE event_name = 'tester_invite_clicked')::text AS invite_clicked
      FROM analytics_events
      WHERE event_name IN ('check_result_viewed', 'tester_invite_shown', 'tester_invite_clicked')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 DESC
    `)
  } catch (err) {
    logger.error('[admin/analytics] failed to query tester funnel', { error: err })
    return []
  }
}

/** 전환율. 분모가 0이면 숫자를 지어내지 않고 빈칸으로 둔다. */
function rate(numerator: string, denominator: string): string {
  const n = parseInt(numerator, 10)
  const d = parseInt(denominator, 10)
  if (!d) return '-'
  return `${Math.round((n / d) * 100)}%`
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
    logger.error('[admin/analytics] failed to query analytics_events', { error: err })
    return []
  }
}

export default async function AdminAnalyticsPage() {
  const [events, funnel] = await Promise.all([getEventStats(), getTesterFunnel()])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이벤트 분석</h1>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          보증금 점검 &rarr; 테스터 전환 (최근 30일)
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          익명 집계입니다. 계정·기기 식별자와 입력하신 금액은 저장하지 않습니다.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {funnel.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p className="text-base font-medium">아직 집계된 날이 없습니다</p>
              <p className="text-sm mt-1">
                /check에서 결과를 본 사람이 생기면 날짜별로 여기에 쌓입니다.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">날짜</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">결과 조회</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">배너 노출</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">배너 클릭</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">클릭률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {funnel.map((row) => (
                  <tr key={row.day} className="hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-gray-800">{row.day}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-800">
                      {parseInt(row.result_viewed, 10).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-800">
                      {parseInt(row.invite_shown, 10).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-blue-700">
                      {parseInt(row.invite_clicked, 10).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                      {rate(row.invite_clicked, row.invite_shown)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <h2 className="text-lg font-bold text-gray-900 mb-3">전체 이벤트 누적</h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium">아직 수집된 이벤트가 없습니다</p>
            <p className="text-sm mt-1">사용자 활동이 발생하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">이벤트명</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">횟수</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">마지막 발생</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((row) => (
                <tr key={row.event_name} className="hover:bg-muted/50 transition-colors">
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
