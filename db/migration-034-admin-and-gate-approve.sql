-- Migration 034: designate the operator admin and approve the automated_scoring
-- gate for the pilot (operator decision, 2026-08).
--
-- Promotes ipjuhae.official@gmail.com to admin, then approves the gate under that
-- admin (the migration-029 audit trigger requires an admin actor). If the account
-- does not exist yet, this is a safe no-op — sign up with that email, then re-run
-- the approval (via the admin console or a follow-up migration).
DO $$
DECLARE
  admin_id UUID;
BEGIN
  UPDATE users SET user_type = 'admin', updated_at = NOW()
   WHERE email = 'ipjuhae.official@gmail.com';

  SELECT id INTO admin_id FROM users WHERE email = 'ipjuhae.official@gmail.com';
  IF admin_id IS NULL THEN
    RAISE NOTICE 'Admin email ipjuhae.official@gmail.com not found; gate left blocked until signup + re-approval.';
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

  RAISE NOTICE 'Admin designated and automated_scoring gate approved.';
END $$;
