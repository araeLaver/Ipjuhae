import { query, queryOne, transaction } from '@/lib/db'
import { Talk, TalkError, emailHash } from './model'
import { TalkStore } from './service'

// 신규 테이블과 인덱스: db/migration-045-contract-talk.sql. 기존 고객 데이터는 변경하지 않는다.
export const postgresTalkStore: TalkStore = {
  async create(talk, surface='web') {
    return transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`contract-talk:${talk.ownerId}`])
      // 이 기능의 만료된 기록만 소량 정리한다. 기존 서비스 테이블은 변경하지 않는다.
      await client.query(`DELETE FROM contract_talk_requests WHERE id IN (SELECT id FROM contract_talk_requests WHERE expires_at < NOW() - interval '30 days' LIMIT 500)`)
      const prior = await client.query<{payload:Talk}>('SELECT payload FROM contract_talk_requests WHERE owner_id=$1 AND client_key=$2', [talk.ownerId,talk.clientKey])
      if (!prior.rows.length) {
        const count = await client.query<{count:string}>(`SELECT count(*)::text AS count FROM contract_talk_requests WHERE owner_id=$1 AND created_at > NOW() - interval '1 day'`, [talk.ownerId])
        if (Number(count.rows[0].count) >= 10) throw new TalkError(429, '하루에 최대 10개의 요청을 만들 수 있습니다.')
      }
      const inserted = await client.query(
        `INSERT INTO contract_talk_requests (id, share_id, owner_id, client_key, version, expires_at, payload, recipient_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT (owner_id,client_key) DO NOTHING RETURNING id`,
        [talk.id, talk.shareId, talk.ownerId, talk.clientKey, talk.version, talk.expiresAt, JSON.stringify(talk), talk.recipientHash],
      )
      if(inserted.rowCount) await record(client,'contract_talk_created',surface)
      const result = await client.query<{ payload: Talk }>(
        'SELECT payload FROM contract_talk_requests WHERE owner_id=$1 AND client_key=$2', [talk.ownerId, talk.clientKey],
      )
      const stored = result.rows[0]?.payload
      if (!stored) throw new TalkError(500, '요청을 저장하지 못했습니다.')
      if (JSON.stringify(stored.slots) !== JSON.stringify(talk.slots) || stored.recipientHash !== talk.recipientHash) throw new TalkError(409, '같은 생성 요청의 내용이 다릅니다.')
      return stored
    })
  },
  async list(actor) {
    const rows=await query<{payload:Talk}>(actor.user_type==='tenant'?
      'SELECT payload FROM contract_talk_requests WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100':
      "SELECT payload FROM contract_talk_requests WHERE payload->>'respondentId'=$1 OR (payload->>'respondentId' IS NULL AND recipient_hash=$2) ORDER BY created_at DESC LIMIT 100",
      actor.user_type==='tenant'?[actor.id]:[actor.id,actor.email?emailHash(actor.email):''])
    return rows.map(r=>r.payload)
  },
  async find(key, shared) {
    const row = await queryOne<{ payload: Talk }>(`SELECT payload FROM contract_talk_requests WHERE ${shared ? 'share_id' : 'id'}=$1`, [key])
    return row?.payload ?? null
  },
  async update(key, shared, fn, surface='web') {
    return transaction(async client => {
      const result = await client.query<{ payload: Talk }>(`SELECT payload FROM contract_talk_requests WHERE ${shared ? 'share_id' : 'id'}=$1 FOR UPDATE`, [key])
      if (!result.rows[0]) throw new TalkError(404, '요청을 찾을 수 없습니다.')
      const next = fn(result.rows[0].payload)
      await client.query('UPDATE contract_talk_requests SET payload=$1::jsonb,version=$2,updated_at=NOW() WHERE id=$3', [JSON.stringify(next), next.version, next.id])
      const old=result.rows[0].payload
      if(!old.cancelled&&next.cancelled) await record(client,'contract_talk_cancelled',surface)
      else {
        if(next.respondentId&&(!old.respondentId||JSON.stringify(old.answers)!==JSON.stringify(next.answers)||old.proposedTime!==next.proposedTime)) await record(client,'contract_talk_responded',surface)
        if(!old.timeAccepted&&next.timeAccepted) await record(client,'contract_talk_schedule_agreed',surface)
        if(next.confirmed.tenant&&next.confirmed.landlord&&!(old.confirmed.tenant&&old.confirmed.landlord)) await record(client,'contract_talk_completed',surface)
      }
      return next
    })
  },
}

async function record(client: import('pg').PoolClient,event:string,surface:string) {
 await client.query('INSERT INTO analytics_events(event_name,properties,user_id,session_id) VALUES($1,$2::jsonb,NULL,NULL)',[event,JSON.stringify({surface})])
}
