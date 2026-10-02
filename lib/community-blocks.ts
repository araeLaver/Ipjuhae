import { queryOne } from '@/lib/db'
export async function communityPairBlocked(viewerId: string | null, authorId: string | null): Promise<boolean> {
  if (!viewerId || !authorId || viewerId === authorId) return false
  return Boolean(await queryOne(`SELECT 1 FROM community_blocks WHERE
    (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`, [viewerId, authorId]))
}
