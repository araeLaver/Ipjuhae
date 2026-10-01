import { queryOne, transaction } from '@/lib/db'
import { Talk, TalkError } from './model'
import { TalkStore } from './service'

// 승인 전 SQL 초안: docs/proposals/contract-talk-schema.sql. 자동 마이그레이션에 등록하지 않는다.
export const postgresTalkStore: TalkStore = {
  async create(talk) {
    return transaction(async client => {
      await client.query(
        `INSERT INTO contract_talk_requests (id, share_id, owner_id, client_key, version, expires_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (owner_id,client_key) DO NOTHING`,
        [talk.id, talk.shareId, talk.ownerId, talk.clientKey, talk.version, talk.expiresAt, JSON.stringify(talk)],
      )
      const result = await client.query<{ payload: Talk }>(
        'SELECT payload FROM contract_talk_requests WHERE owner_id=$1 AND client_key=$2', [talk.ownerId, talk.clientKey],
      )
      const stored = result.rows[0]?.payload
      if (!stored) throw new TalkError(500, '요청을 저장하지 못했습니다.')
      if (JSON.stringify(stored.slots) !== JSON.stringify(talk.slots)) throw new TalkError(409, '같은 생성 요청의 내용이 다릅니다.')
      return stored
    })
  },
  async find(key, shared) {
    const row = await queryOne<{ payload: Talk }>(`SELECT payload FROM contract_talk_requests WHERE ${shared ? 'share_id' : 'id'}=$1`, [key])
    return row?.payload ?? null
  },
  async update(key, shared, fn) {
    return transaction(async client => {
      const result = await client.query<{ payload: Talk }>(`SELECT payload FROM contract_talk_requests WHERE ${shared ? 'share_id' : 'id'}=$1 FOR UPDATE`, [key])
      if (!result.rows[0]) throw new TalkError(404, '요청을 찾을 수 없습니다.')
      const next = fn(result.rows[0].payload)
      await client.query('UPDATE contract_talk_requests SET payload=$1::jsonb,version=$2,updated_at=NOW() WHERE id=$3', [JSON.stringify(next), next.version, next.id])
      return next
    })
  },
}
