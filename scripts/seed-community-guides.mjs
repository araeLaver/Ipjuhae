#!/usr/bin/env node
/**
 * 커뮤니티 운영자 글 심기.
 *
 * 빈 게시판에 들어온 사람은 다시 오지 않는다. 그렇다고 가짜 글을 채우면 안 된다.
 * 그래서 이미 써둔 실제 콘텐츠 — 「등기부 뜯어보기」12편, 「임대인 노트」6편 —
 * 를 운영자 글로 옮긴다. 읽을 값어치가 있는 글이고, 검색으로 들어올 만한 글이다.
 *
 * 자료원은 `marketing/sns/carousels.mjs`다. 원고를 고치면 다시 돌리면 된다 —
 * 제목이 같은 글은 본문만 갱신하므로 중복이 생기지 않는다.
 *
 *   DATABASE_URL=... node scripts/seed-community-guides.mjs [--dry]
 */
import pg from 'pg'
import { SERIES } from '../marketing/sns/carousels.mjs'

const DRY = process.argv.includes('--dry')

/** 슬라이드를 읽을 수 있는 글로 편다. 캐러셀은 넘겨 보는 물건이고 글은 읽는 물건이라 형식이 다르다. */
function composeBody(set, seriesName) {
  const lines = []
  const cover = set.slides.find((s) => s.kind === 'cover')
  if (cover?.sub) lines.push(cover.sub, '')

  for (const s of set.slides) {
    if (s.kind === 'cover' || s.kind === 'end') continue

    const title = s.title?.replace(/\n/g, ' ')
    if (s.kind === 'point') {
      lines.push(`■ ${s.label} — ${title}`)
      if (s.desc) lines.push(s.desc)
    } else if (s.kind === 'list') {
      lines.push(`■ ${title}`)
      for (const item of s.items) lines.push(`· ${item}`)
    } else {
      lines.push(`■ ${title}`)
      if (s.desc) lines.push(s.desc)
    }
    lines.push('')
  }

  lines.push('—')
  lines.push(
    set.next
      ? `${seriesName} 다음 편 — ${set.next}`
      : `${seriesName}은 여기까지입니다.`
  )
  lines.push('')
  lines.push(
    '계약 전에 확인이 막히는 지점이 있으면 글로 남겨주세요. 같은 걸 겪은 사람이 답할 수 있습니다.'
  )

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

await client.connect()
await client.query('SET search_path TO ipjuhae, public')

const admin = await client.query(
  `SELECT id, email FROM users WHERE user_type = 'admin' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`
)
if (!admin.rows.length) {
  console.error('운영자 계정이 없습니다. admin 계정을 먼저 만들어주세요.')
  process.exit(1)
}
const authorId = admin.rows[0].id
console.log('작성자:', admin.rows[0].email)

let created = 0
let updated = 0

for (const series of SERIES) {
  for (const set of series.sets) {
    const title = `${series.name} #${set.num} — ${set.title}`
    const body = composeBody(set, series.name)

    if (DRY) {
      console.log(`\n===== ${title}\n${body.slice(0, 200)}…`)
      continue
    }

    const existing = await client.query(
      `SELECT id FROM community_posts WHERE title = $1 AND deleted_at IS NULL`,
      [title]
    )

    if (existing.rows.length) {
      await client.query(
        `UPDATE community_posts SET body = $1, updated_at = NOW() WHERE id = $2`,
        [body, existing.rows[0].id]
      )
      updated++
    } else {
      // 전부 '전체' 판에 둔다. 역할 판은 로그인해야 읽히는데, 이 글들은
      // 검색으로 들어온 사람이 바로 읽을 수 있어야 의미가 있다.
      await client.query(
        `INSERT INTO community_posts (author_id, audience, category, title, body)
         VALUES ($1, 'all', $2, $3, $4)`,
        [authorId, series.name, title, body]
      )
      created++
    }
  }
}

if (!DRY) console.log(`새 글 ${created}건 · 갱신 ${updated}건`)
await client.end()
