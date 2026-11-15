import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, transaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { searchFiltersSchema } from '@/lib/saved-search'

const selectFields = 'id, q, region, property_type AS "propertyType", sort, alerts_enabled, created_at'
const createSchema = z.object({ filters: searchFiltersSchema, alertsEnabled: z.boolean().default(false) }).strict()
const updateSchema = z.object({ id: z.string().uuid(), alertsEnabled: z.boolean() }).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)
  try {
    const searches = await query(`SELECT ${selectFields} FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`, [user.id])
    return json({ searches, alertsAvailable: process.env.SAVED_SEARCH_ALERTS_ENABLED === 'true' })
  } catch (error) {
    logger.error('저장 검색 조회 실패', { error })
    return json({ error: '저장한 검색을 불러오지 못했습니다' }, 500)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '검색 조건을 확인해 주세요' }, 400)
  const { filters, alertsEnabled } = parsed.data
  if (alertsEnabled && process.env.SAVED_SEARCH_ALERTS_ENABLED !== 'true') return json({ error: '새 매물 알림은 아직 이용할 수 없습니다' }, 503)
  try {
    const result = await transaction(async client => {
      // Serialize creates for this account so concurrent requests cannot exceed the cap.
      const account = await client.query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [user.id])
      if (!account.rows.length) return { error: '로그인이 필요합니다', status: 401 }
      const values = [user.id, filters.q, filters.region, filters.propertyType, filters.sort]
      const existing = await client.query(`SELECT ${selectFields} FROM saved_searches WHERE user_id = $1 AND q = $2 AND region = $3 AND property_type = $4 AND sort = $5`, values)
      if (existing.rows.length) return { search: existing.rows[0], alreadySaved: true, status: 200 }
      const count = await client.query('SELECT COUNT(*)::int AS count FROM saved_searches WHERE user_id = $1', [user.id])
      if (count.rows[0].count >= 10) return { error: '검색 조건은 최대 10개까지 저장할 수 있습니다', status: 409 }
      const inserted = await client.query(`INSERT INTO saved_searches (user_id, q, region, property_type, sort, alerts_enabled) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${selectFields}`, [...values, alertsEnabled])
      return { search: inserted.rows[0], status: 201 }
    })
    const { status, ...body } = result
    return json(body, status)
  } catch (error) {
    logger.error('검색 조건 저장 실패', { error })
    return json({ error: '검색 조건을 저장하지 못했습니다' }, 500)
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '알림 설정을 확인해 주세요' }, 400)
  if (parsed.data.alertsEnabled && process.env.SAVED_SEARCH_ALERTS_ENABLED !== 'true') return json({ error: '새 매물 알림은 아직 이용할 수 없습니다' }, 503)
  try {
    const rows = await query(`UPDATE saved_searches SET
      alerts_since = CASE WHEN $3 AND NOT alerts_enabled THEN NOW() ELSE alerts_since END,
      alerts_enabled = $3
      WHERE id = $1 AND user_id = $2 RETURNING ${selectFields}`, [parsed.data.id, user.id, parsed.data.alertsEnabled])
    return rows.length ? json({ search: rows[0] }) : json({ error: '저장한 검색을 찾을 수 없습니다' }, 404)
  } catch (error) {
    logger.error('검색 알림 설정 실패', { error })
    return json({ error: '알림 설정을 변경하지 못했습니다' }, 500)
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: '로그인이 필요합니다' }, 401)
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '삭제할 검색을 확인해 주세요' }, 400)
  try {
    const rows = await query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 RETURNING id', [parsed.data.id, user.id])
    return rows.length ? json({ ok: true }) : json({ error: '저장한 검색을 찾을 수 없습니다' }, 404)
  } catch (error) {
    logger.error('저장 검색 삭제 실패', { error })
    return json({ error: '검색 조건을 삭제하지 못했습니다' }, 500)
  }
}
