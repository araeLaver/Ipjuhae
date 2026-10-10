/** Visible comments by an operator only. Never equate every comment with an answer. */
export const OPERATOR_REPLY_SQL = `EXISTS (
  SELECT 1 FROM community_comments reply
  JOIN users responder ON responder.id = reply.author_id
  WHERE reply.post_id = p.id AND reply.hidden_at IS NULL AND reply.deleted_at IS NULL
    AND responder.user_type = 'admin'
)`
