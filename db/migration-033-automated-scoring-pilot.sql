-- Migration 033: pilot approval of the automated_scoring compliance gate.
-- Operator decision (2026-08): enable trust scoring + transaction-condition
-- recommendations for the pilot. Weights remain provisional and manual review
-- is still required; the approval_reference documents the pilot nature so the
-- gate can be re-blocked or re-approved with evidence after legal/fairness review.
UPDATE trust_compliance_gates
   SET status = 'approved',
       approval_reference = 'pilot-approval-2026-08: operator decision; provisional weights; manual review required',
       approved_by = COALESCE(
         (SELECT id FROM users WHERE user_type = 'admin' ORDER BY created_at LIMIT 1),
         (SELECT id FROM users ORDER BY created_at LIMIT 1)
       ),
       approved_at = NOW(),
       notes = '파일럿 활성화. 근거 기반 가중치 확정 및 차별영향·설명가능성 법무 검토 전까지 잠정 운영.',
       updated_at = NOW()
 WHERE gate_key = 'automated_scoring';
