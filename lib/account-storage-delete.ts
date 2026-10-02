import { transaction } from '@/lib/db'
import { otherAccountStorageReferences } from '@/lib/storage-sharing'
import { storageObjectScope } from '@/lib/storage-ownership'
import { deleteFile } from '@/lib/storage'

// Lock each batch to permit overlapping authenticated cleanup jobs. Failed objects
// remain queued; DeleteObject is idempotent, including crash after remote success.
export async function drainAccountStorageDeletes(): Promise<{ deleted: number; retrying: number; review: number }> {
  return transaction(async client => {
    let deleted=0
    // Missing or changed ownership/destination proof quarantines a queue entry.
    await client.query(`UPDATE account_storage_deletes q SET status='review',last_error_code='OWNERSHIP_UNVERIFIED'
      WHERE status IN ('pending','retry') AND (storage_scope IS DISTINCT FROM $1 OR NOT EXISTS
        (SELECT 1 FROM account_storage_objects o WHERE o.object_key=q.object_key
          AND o.owner_user_id=q.owner_user_id AND o.storage_scope=q.storage_scope))`, [storageObjectScope()])
    const { rows } = await client.query<{ object_key: string; owner_user_id: string }>(
      `SELECT object_key,owner_user_id FROM account_storage_deletes WHERE status IN ('pending','retry') AND next_attempt_at<=NOW()
       ORDER BY next_attempt_at,attempts,created_at LIMIT 20 FOR UPDATE SKIP LOCKED`
    )
    const references=new Map<string,Set<string>>()
    for (const row of rows) {
      let shared=references.get(row.owner_user_id)
      if (!shared) { shared=await otherAccountStorageReferences(client,row.owner_user_id);references.set(row.owner_user_id,shared) }
      if(shared.has(row.object_key)) {
        await client.query("UPDATE account_storage_deletes SET status='review',last_error_code='SHARED_REFERENCE' WHERE object_key=$1",[row.object_key])
        continue
      }
      let success=false
      try { success=(await deleteFile(row.object_key)).success } catch {}
      if (success) {
        await client.query('DELETE FROM account_storage_deletes WHERE object_key=$1', [row.object_key])
        await client.query('DELETE FROM account_storage_objects WHERE object_key=$1', [row.object_key]);deleted++
      } else {
        await client.query(`UPDATE account_storage_deletes SET attempts=attempts+1,
          status=CASE WHEN attempts+1>=5 THEN 'review' ELSE 'retry' END,
          next_attempt_at=NOW()+interval '1 minute'*power(2,least(attempts,6)),
          last_error_code='OBJECT_DELETE_FAILED' WHERE object_key=$1`, [row.object_key])
      }
    }
    const counts=await client.query<{retrying:number;review:number}>(`SELECT
      count(*) FILTER(WHERE status='retry')::int AS retrying,count(*) FILTER(WHERE status='review')::int AS review
      FROM account_storage_deletes`)
    return {deleted,retrying:counts.rows[0]?.retrying??0,review:counts.rows[0]?.review??0}
  })
}

// Only configured storage origin/path is accepted; arbitrary external URLs are
// never treated as owned objects. Unknown references fail closed before erasure.
export function ownedStorageKey(url: string): string {
  const base = process.env.STORAGE_PROVIDER === 's3'
    ? process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`
    : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/mock-storage`
  const prefix = new URL(base.endsWith('/') ? base : `${base}/`)
  const target = new URL(url)
  if (target.username || target.password || target.origin !== prefix.origin || !target.pathname.startsWith(prefix.pathname) || target.search || target.hash) {
    throw new Error('Unrecognized account storage reference')
  }
  const key = decodeURIComponent(target.pathname.slice(prefix.pathname.length))
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) throw new Error('Invalid account storage key')
  return key
}
