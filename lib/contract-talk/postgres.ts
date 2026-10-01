import { queryOne, transaction } from '@/lib/db'
import { Talk, TalkError } from './model'
import { TalkStore } from './service'

// 신규 테이블과 인덱스: db/migration-045-contract-talk.sql. 기존 고객 데이터는 변경하지 않는다.
export const postgresTalkStore: TalkStore = {
  async create(talk) {
    return transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`contract-talk:${talk.ownerId}`])
      // 이 기능의 만료된 기록만 소량 정리한다. 기존 서비스 테이블은 변경하지 않는다.
      await client.query(`DELETE FROM contract_talk_requests WHERE id IN (SELECT id FROM contract_talk_requests WHERE expires_at < NOW() - interval '30 days' LIMIT 500)`)
      const prior = await client.query<{payload:Talk}>('SELECT payload FROM contract_talk_requests WHERE owner_id=$1 AND client_key=$2', [talk.ownerId,talk.clientKey])
      if (!prior.rows.length) {
        const count = await client.query<{count:string}>(`SELECT count(*)::text AS count FROM contract_talk_requests WHERE owner_id=$1 AND created_at > NOW() - interval '1 day'`, [talk.ownerId])
        if (Number(count.rows[0].count) >= 10) throw new TalkError(429, '하루에 최대 10개의 요청을 만들 수 있습니다.')
      }
      await client.query(
        `INSERT INTO contract_talk_requests (id, share_id, owner_id, client_key, version, expires_at, payload, recipient_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT (owner_id,client_key) DO NOTHING`,
        [talk.id, talk.shareId, talk.ownerId, talk.clientKey, talk.version, talk.expiresAt, JSON.stringify(talk), talk.recipientHash],
      )
      const result = await client.query<{ payload: Talk }>(
        'SELECT payload FROM contract_talk_requests WHERE owner_id=$1 AND client_key=$2', [talk.ownerId, talk.clientKey],
      )
      const stored = result.rows[0]?.payload
      if (!stored) throw new TalkError(500, '요청을 저장하지 못했습니다.')
      if (JSON.stringify(stored.slots) !== JSON.stringify(talk.slots) || stored.recipientHash !== talk.recipientHash) throw new TalkError(409, '같은 생성 요청의 내용이 다릅니다.')
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
