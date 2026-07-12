-- Migration 027: align the tenant score model with verified evidence semantics.

UPDATE trust_score_models
   SET ruleset = '{"rules":[{"field":"identity_verified","weight":15,"reason":"IDENTITY_CONFIRMED"},{"field":"employment_verified","weight":20,"reason":"EMPLOYMENT_CONFIRMED"},{"field":"income_verified","weight":20,"reason":"INCOME_CONFIRMED"},{"field":"credit_verified","weight":10,"reason":"CREDIT_CONFIRMED"},{"field":"relationship_verified","weight":20,"reason":"RELATIONSHIP_VERIFIED"},{"field":"payment_reliable","weight":15,"reason":"PAYMENT_RELIABLE"}]}'::JSONB
 WHERE subject_type = 'tenant'
   AND version = 'tenant-trust-1.0';

