import { transaction } from './db'
import { logger } from './logger'
import { searchLabel, searchUrl, type SavedSearch } from './saved-search'

// Notifications and deduplication records commit together. Row locks also
// serialize settings changes with dispatch, including concurrent Fly workers.
export async function dispatchSavedSearchAlerts(batchSize = 20) {
  const limit = Math.min(50, Math.max(1, Math.floor(batchSize) || 20))
  return transaction(async client => {
    const { rows: searches } = await client.query<SavedSearch>(`
      SELECT s.id, s.user_id, s.q, s.region, s.property_type AS "propertyType", s.sort
      FROM saved_searches s JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
      WHERE s.alerts_enabled
        AND s.last_checked_at <= NOW() - INTERVAL '1 minute'
      ORDER BY s.last_checked_at, s.id
      LIMIT $1 FOR UPDATE OF s SKIP LOCKED`, [limit])
    let notifications = 0
    for (const search of searches) {
      const { rows: delivered } = await client.query<{ property_id: string }>(`
        INSERT INTO saved_search_deliveries (search_id, property_id)
        SELECT s.id, p.id FROM saved_searches s
        JOIN properties p ON p.status = 'available' AND p.created_at > s.alerts_since
        JOIN users owner ON owner.id = p.landlord_id AND owner.deleted_at IS NULL
        WHERE s.id = $1 AND p.landlord_id <> s.user_id
          AND (s.region = '' OR p.region = s.region)
          AND (s.property_type = '' OR p.property_type = s.property_type)
          AND (s.q = '' OR p.title ILIKE '%' || s.q || '%' OR p.address ILIKE '%' || s.q || '%')
          AND NOT EXISTS (SELECT 1 FROM saved_search_deliveries d WHERE d.search_id = s.id AND d.property_id = p.id)
        ORDER BY p.created_at, p.id LIMIT 20
        ON CONFLICT DO NOTHING RETURNING property_id`, [search.id])
      if (delivered.length) {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, body, link, metadata)
          SELECT user_id, 'admin_notice', $2, $3, $4, $5::jsonb
          FROM saved_searches WHERE id = $1`, [
          search.id, '저장한 조건에 맞는 새 매물이 있어요',
          `${searchLabel(search)} 조건에 맞는 신규 매물 ${delivered.length}건을 확인해 보세요.`,
          searchUrl(search), JSON.stringify({ kind: 'saved_search_match', searchId: search.id, propertyIds: delivered.map(row => row.property_id) }),
        ])
        notifications++
      }
      await client.query('UPDATE saved_searches SET last_checked_at = NOW() WHERE id = $1', [search.id])
    }
    return { checked: searches.length, notifications }
  })
}

export function startSavedSearchScheduler() {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try { await dispatchSavedSearchAlerts() }
    catch (error) { logger.error('저장 검색 알림 처리 실패', { error }) }
    finally { running = false }
  }
  void tick()
  const timer = setInterval(() => { void tick() }, 60_000)
  timer.unref()
  return () => clearInterval(timer)
}
