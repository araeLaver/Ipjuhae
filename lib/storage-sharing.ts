import type { PoolClient } from 'pg'

// Canonicalize for protection only: a match blocks deletion and NEVER authorizes
// it. Query/fragment/userinfo aliases cannot evade a shared-reference hold.
export function canonicalStorageReferenceKey(raw: string): string | null {
  const bases = process.env.STORAGE_PROVIDER === 's3'
    ? [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT && process.env.S3_BUCKET ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}` : undefined,
      process.env.S3_BUCKET ? `https://${process.env.S3_BUCKET}.s3.amazonaws.com` : undefined]
    : [`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/mock-storage`]
  try {
    const target = new URL(raw)
    for (const rawBase of bases) {
      if (!rawBase) continue
      const base = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`)
      if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) continue
      const key=decodeURIComponent(target.pathname.slice(base.pathname.length))
      if (key && !key.includes('..') && !key.startsWith('/') && !key.includes('\\')) return key
    }
  } catch {}
  return null
}

export async function otherAccountStorageReferences(client: PoolClient, ownerId: string): Promise<Set<string>> {
  // No limit: truncation could miss a sharing hold. DB timeout fails the erasure
  // transaction closed; this scan needs load validation before production rollout.
  const result=await client.query<{url:string}>(`SELECT profile_image AS url FROM users WHERE id<>$1 AND profile_image IS NOT NULL
    UNION SELECT file_url FROM verification_documents WHERE user_id<>$1 AND file_url IS NOT NULL
    UNION SELECT i.image_url FROM property_images i JOIN properties p ON p.id=i.property_id WHERE p.landlord_id<>$1
    UNION SELECT i.thumbnail_url FROM property_images i JOIN properties p ON p.id=i.property_id WHERE p.landlord_id<>$1 AND i.thumbnail_url IS NOT NULL
    UNION SELECT unnest(photo_urls) FROM listings WHERE landlord_id<>$1`, [ownerId])
  const keys=new Set<string>()
  for(const row of result.rows) {const key=canonicalStorageReferenceKey(row.url);if(key)keys.add(key)}
  return keys
}
