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
  const talkCounts = await query<{day:string;event_name:string;surface:string;count:string}>(`SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul')::text AS day,event_name,properties->>'surface' AS surface,COUNT(*)::text AS count FROM analytics_events WHERE event_name IN ('contract_talk_created','contract_talk_responded','contract_talk_schedule_agreed','contract_talk_completed','contract_talk_cancelled') AND created_at > NOW()-interval '30 days' GROUP BY 1,2,3 ORDER BY 1 DESC`).catch(()=>[])
  const activation = await query<{ day: string; started: string; results: string; ask: string; talk: string; guide: string; saved: string; compared: string; checklist: string }>(`
    SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE event_name = 'check_started')::text AS started,
      COUNT(*) FILTER (WHERE event_name = 'check_result_viewed')::text AS results,
      COUNT(*) FILTER (WHERE event_name = 'check_next_action_clicked' AND properties->>'action' = 'ask')::text AS ask,
      COUNT(*) FILTER (WHERE event_name = 'check_next_action_clicked' AND properties->>'action' = 'contract_talk')::text AS talk,
      COUNT(*) FILTER (WHERE event_name = 'check_next_action_clicked' AND properties->>'action' = 'guide')::text AS guide,
      COUNT(*) FILTER (WHERE event_name = 'check_candidate_saved')::text AS saved,
      COUNT(*) FILTER (WHERE event_name = 'check_comparison_viewed')::text AS compared,
      COUNT(*) FILTER (WHERE event_name = 'check_checklist_updated')::text AS checklist
    FROM analytics_events
    WHERE event_name IN ('check_started', 'check_result_viewed', 'check_next_action_clicked', 'check_candidate_saved', 'check_comparison_viewed', 'check_checklist_updated')
      AND properties->>'surface' = 'web' AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1 DESC
  `).catch((error) => { logger.error('Activation metrics unavailable', { error }); return null })
  const [events, funnel] = await Promise.all([getEventStats(), getTesterFunnel()])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이벤트 분석</h1>

      <section className="mb-8 space-y-3">
        <h2 className="text-lg font-bold">보증금 점검 → 다음 행동 · 최근 30일</h2>
        <p className="text-sm text-gray-500">익명 동작 횟수입니다. 고유 사용자 수·전환율·재방문율이 아닙니다. 입력 시작과 다음 행동은 이번 기능 적용일부터 집계됩니다.</p>
        {activation === null ? <p role="alert">활성화 집계를 불러오지 못했습니다. 잠시 후 다시 확인하세요.</p> : activation.length === 0 ? <p>아직 집계가 없습니다.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['날짜', '입력 시작', '결과 조회', '질문 클릭', '계약 대화 클릭', '관련 글 클릭', '후보 저장', '비교 조회', '확인 기록 변경'].map(label => <th className="p-2 text-left" key={label}>{label}</th>)}</tr></thead><tbody>{activation.map(row => <tr key={row.day}>{[row.day, row.started, row.results, row.ask, row.talk, row.guide, row.saved, row.compared, row.checklist].map((value, i) => <td className="p-2" key={i}>{value}</td>)}</tr>)}</tbody></table></div>}
      </section>
      <section className="mb-8"><h2 className="text-lg font-bold">계약 전 대화 · 최근 30일 익명 동작 집계</h2><p className="text-sm text-gray-500">성공한 저장·변경 횟수입니다. 고유 사용자 수나 전환율이 아니며 이메일·계정·요청 ID·본문을 기록하지 않습니다.</p>{!talkCounts.length?<p>아직 집계가 없습니다.</p>:<ul>{talkCounts.map((r,i)=><li key={i}>{r.day} · {r.surface} · {r.event_name} · {r.count}건</li>)}</ul>}</section>
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
