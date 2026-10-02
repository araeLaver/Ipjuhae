import type { PoolClient } from 'pg'
import { emailHash } from '@/lib/contract-talk/model'
import { storageObjectScope, assertServerUploadNamespace } from '@/lib/storage-ownership'
import { ownedStorageKey } from '@/lib/account-storage-delete'

export class DeletionReviewRequired extends Error {}

export async function eraseAccountData(client: PoolClient, userId: string, email: string): Promise<string[]> {
  // Serialize repeat requests and collect the old identifiers before scrubbing.
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
  // Shared trust/contract records require an explicit retention/participant policy.
  // Refuse the whole transaction instead of reporting a successful partial erasure.
  const review = await client.query<{ required: boolean }>(`SELECT
    EXISTS(SELECT 1 FROM users WHERE id=$1 AND stripe_customer_id IS NOT NULL) OR
    EXISTS(SELECT 1 FROM trust_evidence_nodes WHERE owner_user_id=$1 OR subject_id=$1 OR property_id IN (SELECT id FROM properties WHERE landlord_id=$1)) OR
    EXISTS(SELECT 1 FROM contract_check_reports WHERE owner_id=$1 OR tenant_id=$1 OR landlord_id=$1 OR realtor_id=$1 OR property_id IN (SELECT id FROM properties WHERE landlord_id=$1)) OR
    EXISTS(SELECT 1 FROM document_intakes WHERE owner_user_id=$1 OR subject_id=$1) OR
    EXISTS(SELECT 1 FROM trust_fact_nodes WHERE subject_id=$1) OR
    EXISTS(SELECT 1 FROM trust_derived_nodes WHERE subject_id=$1) OR
    EXISTS(SELECT 1 FROM trust_score_runs WHERE subject_id=$1) OR
    EXISTS(SELECT 1 FROM trust_disclosure_packages WHERE subject_id=$1) OR
    EXISTS(SELECT 1 FROM trust_transaction_contexts WHERE created_by=$1 OR tenant_id=$1 OR landlord_id=$1 OR realtor_id=$1) OR
    EXISTS(SELECT 1 FROM trust_organization_memberships WHERE user_id=$1) OR
    EXISTS(SELECT 1 FROM trust_tenancy_relationships WHERE tenant_id=$1 OR landlord_id=$1) OR
    EXISTS(SELECT 1 FROM trust_reference_submissions WHERE subject_id=$1 OR responder_id=$1)
    AS required`, [userId])
  if (review.rows[0]?.required) throw new DeletionReviewRequired()
  const oldDestination=await client.query('SELECT 1 FROM account_storage_objects WHERE owner_user_id=$1 AND storage_scope<>$2 LIMIT 1',[userId,storageObjectScope()])
  if (oldDestination.rows.length) throw new DeletionReviewRequired()

  // Discover every additional FK to users in the active schema. New tables fail
  // closed until a deletion policy is added; no silent omission after migration.
  const handled = new Set(['users', 'profiles', 'tenant_profiles', 'landlord_profiles', 'conversations', 'messages', 'properties', 'property_images', 'listings', 'verification_documents', 'verifications', 'landlord_references', 'tenant_favorites', 'profile_views', 'notifications', 'notification_preferences', 'push_tokens', 'data_consents', 'consent_events', 'reviews', 'community_posts', 'community_comments', 'community_reports', 'analytics_events', 'api_idempotency_requests', 'contract_talk_requests', 'revoked_tokens', 'community_blocks', 'account_storage_objects', 'account_storage_deletes'])
  const references = await client.query<{ table_name: string; column_name: string }>(`SELECT DISTINCT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING(constraint_catalog, constraint_schema, constraint_name)
    JOIN information_schema.constraint_column_usage ccu USING(constraint_catalog, constraint_schema, constraint_name)
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=current_schema()
      AND ccu.table_name='users' AND ccu.column_name='id'`)
  for (const ref of references.rows) {
    if (handled.has(ref.table_name)) continue
    // Identifiers originate from the schema, and are quoted, never request input.
    const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"'
    const found = await client.query(`SELECT 1 FROM ${quote(ref.table_name)} WHERE ${quote(ref.column_name)}=$1 LIMIT 1`, [userId])
    if (found.rows.length) throw new DeletionReviewRequired()
  }
  const jsonColumns = await client.query<{ table_name: string; column_name: string }>(`SELECT table_name,column_name
    FROM information_schema.columns WHERE table_schema=current_schema() AND data_type='jsonb'`)
  for (const ref of jsonColumns.rows) {
    if (handled.has(ref.table_name)) continue
    const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"'
    const found = await client.query(`SELECT 1 FROM ${quote(ref.table_name)} WHERE
      strpos(${quote(ref.column_name)}::text,$1)>0 OR strpos(${quote(ref.column_name)}::text,$2)>0 LIMIT 1`, [userId, email])
    if (found.rows.length) throw new DeletionReviewRequired()
  }
  const objects = await client.query<{ url: string }>(`SELECT profile_image AS url FROM users WHERE id=$1 AND profile_image IS NOT NULL
      AND NOT (COALESCE(auth_provider,'')='google' AND profile_image LIKE 'https://lh3.googleusercontent.com/%')
    UNION SELECT file_url FROM verification_documents WHERE user_id=$1 AND file_url IS NOT NULL
    UNION SELECT image_url FROM property_images WHERE property_id IN (SELECT id FROM properties WHERE landlord_id=$1)
    UNION SELECT thumbnail_url FROM property_images WHERE property_id IN (SELECT id FROM properties WHERE landlord_id=$1) AND thumbnail_url IS NOT NULL
    UNION SELECT unnest(photo_urls) FROM listings WHERE landlord_id=$1`, [userId])
  for (const { url } of objects.rows) {
    const shared = await client.query<{ shared: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM users WHERE id<>$1 AND profile_image=$2) OR
      EXISTS(SELECT 1 FROM verification_documents WHERE user_id<>$1 AND file_url=$2) OR
      EXISTS(SELECT 1 FROM property_images i JOIN properties p ON p.id=i.property_id
        WHERE p.landlord_id<>$1 AND (i.image_url=$2 OR i.thumbnail_url=$2)) OR
      EXISTS(SELECT 1 FROM listings WHERE landlord_id<>$1 AND $2=ANY(photo_urls)) AS shared`, [userId, url])
    if (shared.rows[0]?.shared) throw new DeletionReviewRequired()
    let key: string
    try { key = ownedStorageKey(url) } catch { throw new DeletionReviewRequired() }
    // A URL/reference and raw-string sharing check are never ownership proof.
    try { assertServerUploadNamespace(key,userId) } catch { throw new DeletionReviewRequired() }
    const proof = await client.query('SELECT 1 FROM account_storage_objects WHERE object_key=$1 AND owner_user_id=$2 AND storage_scope=$3', [key,userId,storageObjectScope()])
    if (!proof.rows.length) throw new DeletionReviewRequired()
  }
  await client.query(`INSERT INTO account_storage_deletes(object_key,owner_user_id,storage_scope)
    SELECT object_key,owner_user_id,storage_scope FROM account_storage_objects
    WHERE owner_user_id=$1 AND storage_scope=$2 ON CONFLICT DO NOTHING`, [userId,storageObjectScope()])
  // Both participants lose the shared conversation; no third-party conversation
  // is touched. This follows the existing UI's promise to erase conversation data.
  const conversations = await client.query<{ id: string }>('DELETE FROM conversations WHERE landlord_id=$1 OR tenant_id=$1 RETURNING id', [userId])
  await client.query("DELETE FROM notifications WHERE type='new_message' AND metadata->>'conversationId'=ANY($1::text[])", [conversations.rows.map(row=>row.id)])
  await client.query("DELETE FROM contract_talk_requests WHERE owner_id=$1::uuid OR payload->>'respondentId'=$1::text OR recipient_hash=$2", [userId, emailHash(email)])
  await client.query('DELETE FROM verification_documents WHERE user_id=$1', [userId])
  await client.query('DELETE FROM verifications WHERE user_id=$1', [userId])
  await client.query('DELETE FROM landlord_references WHERE user_id=$1', [userId])
  await client.query('DELETE FROM tenant_favorites WHERE landlord_id=$1 OR tenant_id=$1', [userId])
  await client.query('DELETE FROM profile_views WHERE landlord_id=$1 OR profile_id IN (SELECT id FROM profiles WHERE user_id=$1)', [userId])
  await client.query('DELETE FROM profiles WHERE user_id=$1', [userId])
  await client.query('DELETE FROM tenant_profiles WHERE user_id=$1', [userId])
  await client.query('DELETE FROM landlord_profiles WHERE user_id=$1', [userId])
  await client.query('DELETE FROM property_images WHERE property_id IN (SELECT id FROM properties WHERE landlord_id=$1)', [userId])
  await client.query("UPDATE properties SET status='hidden', title='탈퇴 회원 비공개 매물', description=NULL, address='탈퇴 회원 비공개 매물', address_detail=NULL, region=NULL, updated_at=NOW() WHERE landlord_id=$1", [userId])
  await client.query("UPDATE listings SET status='hidden', address='탈퇴 회원 비공개 매물', photo_urls='{}', updated_at=NOW() WHERE landlord_id=$1", [userId])
  for (const table of ['notifications', 'notification_preferences', 'push_tokens', 'data_consents', 'consent_events']) {
    await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId])
  }
  await client.query('DELETE FROM reviews WHERE reviewer_id=$1 OR reviewee_id=$1', [userId])
  await client.query('DELETE FROM community_posts WHERE author_id=$1', [userId])
  await client.query('DELETE FROM community_comments WHERE author_id=$1', [userId])
  await client.query('DELETE FROM community_reports WHERE reporter_id=$1', [userId])
  await client.query('DELETE FROM waitlist WHERE email=$1 OR phone IN (SELECT phone_number FROM users WHERE id=$2)', [email, userId])
  await client.query('DELETE FROM early_access WHERE email=$1', [email])
  await client.query('DELETE FROM feature_requests WHERE contact=$1 OR contact IN (SELECT phone_number FROM users WHERE id=$2)', [email, userId])
  await client.query('DELETE FROM magic_link_tokens WHERE email=$1', [email])
  await client.query('DELETE FROM phone_verifications WHERE phone_number IN (SELECT phone_number FROM users WHERE id=$1)', [userId])
  await client.query('UPDATE analytics_events SET user_id=NULL, session_id=NULL, properties=\'{}\'::jsonb WHERE user_id=$1::uuid OR strpos(properties::text,$1::text)>0 OR strpos(properties::text,$2)>0', [userId,email])
  await client.query('UPDATE revoked_tokens SET user_id=NULL WHERE user_id=$1', [userId])
  await client.query('DELETE FROM community_blocks WHERE blocker_id=$1 OR blocked_id=$1', [userId])
  await client.query('DELETE FROM api_idempotency_requests WHERE actor_user_id=$1', [userId])
  await client.query(`UPDATE users SET email=$1, name='탈퇴한 사용자', phone_number=NULL, phone_verified=FALSE,
    profile_image=NULL, auth_provider=NULL, auth_provider_id=NULL, password_hash='deleted',
    terms_agreed_at=NULL, privacy_agreed_at=NULL, marketing_agreed_at=NULL, deleted_at=NOW(), updated_at=NOW() WHERE id=$2`, [`deleted_${userId}@deleted.invalid`, userId])
  return conversations.rows.map(row => row.id)
}
