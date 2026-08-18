-- Migration 035: promote the operator admin and approve the automated_scoring
-- gate now that the account exists. Fails loudly if the account is missing so a
-- successful apply confirms the pilot is fully enabled.
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'ipjuhae.official@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'admin account ipjuhae.official@gmail.com not found; sign up first, then re-run';
  END IF;

  UPDATE users SET user_type = 'admin', updated_at = NOW() WHERE id = admin_id;

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
