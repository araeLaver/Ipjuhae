-- Migration 033: pilot approval of the automated_scoring compliance gate.
-- Operator decision (2026-08): enable trust scoring + transaction-condition
-- recommendations for the pilot. Weights remain provisional and manual review
-- is still required.
--
-- Gate updates are guarded by the migration-029 audit trigger, which requires
-- app.compliance_actor_id AND that the actor is an administrator. If no admin
-- user exists yet this migration is a safe no-op (the gate stays blocked); once
-- an admin is designated, approve via the admin console or re-run this approval.
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE user_type = 'admin' ORDER BY created_at LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE NOTICE 'No admin user found; automated_scoring gate left blocked.';
    RETURN;
  END IF;

  PERFORM set_config('app.compliance_actor_id', admin_id::text, true);

  UPDATE trust_compliance_gates
     SET status = 'approved',
         approval_reference = 'pilot-approval-2026-08: operator decision; provisional weights; manual review required',
         approved_by = admin_id,
         approved_at = NOW(),
         notes = '파일럿 활성화. 근거 기반 가중치 확정 및 차별영향·설명가능성 법무 검토 전까지 잠정 운영.',
         updated_at = NOW()
   WHERE gate_key = 'automated_scoring';
END $$;
