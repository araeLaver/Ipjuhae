import { transaction } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

// Lock each batch to permit overlapping authenticated cleanup jobs. Failed objects
// remain queued; DeleteObject is idempotent, including crash after remote success.
export async function drainAccountStorageDeletes(): Promise<void> {
  await transaction(async client => {
    const { rows } = await client.query<{ object_key: string }>(
      'SELECT object_key FROM account_storage_deletes ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED'
    )
    for (const row of rows) {
      try {
        const result = await deleteFile(row.object_key)
        if (result.success) {
          await client.query('DELETE FROM account_storage_deletes WHERE object_key=$1', [row.object_key])
        } else {
          await client.query('UPDATE account_storage_deletes SET attempts=attempts+1 WHERE object_key=$1', [row.object_key])
        }
      } catch {
        await client.query('UPDATE account_storage_deletes SET attempts=attempts+1 WHERE object_key=$1', [row.object_key])
      }
    }
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
  if (target.origin !== prefix.origin || !target.pathname.startsWith(prefix.pathname) || target.search || target.hash) {
    throw new Error('Unrecognized account storage reference')
  }
  const key = decodeURIComponent(target.pathname.slice(prefix.pathname.length))
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) throw new Error('Invalid account storage key')
  return key
}
