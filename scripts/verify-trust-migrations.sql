-- ============================================================================
-- Trust 마이그레이션 프로덕션 적용 검증 (읽기 전용)
-- 대상: migration-028 / 029 / 033
-- 목적: "_migrations 이력엔 적용됐다고 나오지만 런타임 DB엔 테이블이 없다"는
--       과거 사고(cron trust 사고: migrate DB ≠ 런타임 DB)를 재확인.
-- 사용: 반드시 "런타임 앱이 실제로 붙는 DB"에 접속해서 실행할 것.
--   psql "$RUNTIME_DATABASE_URL" -f scripts/verify-trust-migrations.sql
-- 어떤 쓰기도 하지 않음(SELECT only). 안전.
-- ============================================================================

\echo '========== [0] 접속한 DB 확인 =========='
SELECT current_database() AS db, current_user AS role, current_schema() AS schema;

\echo ''
\echo '========== [1] 마이그레이션 이력(_migrations) =========='
-- 이력에 028/029/033 이 기록돼 있는가?
SELECT name
  FROM _migrations
 WHERE name LIKE '%028%'
    OR name LIKE '%029%'
    OR name LIKE '%033%'
 ORDER BY name;

\echo ''
\echo '========== [2] 실제 테이블 존재 여부 (런타임 진실) =========='
-- 이력과 무관하게, 런타임 DB에 테이블이 실제로 있는가?
WITH expected(tbl) AS (
  VALUES
    ('trust_organizations'),
    ('trust_organization_memberships'),
    ('trust_organization_api_clients'),
    ('contract_check_reports'),
    ('contract_check_items'),
    ('trust_cards'),
    ('trust_card_access_logs'),
    ('document_intakes'),
    ('ai_processing_runs'),
    ('validation_experiments'),
    ('trust_compliance_gates'),           -- 028
    ('trust_compliance_gate_events')      -- 029
)
SELECT e.tbl AS expected_table,
       CASE WHEN t.tablename IS NOT NULL THEN 'OK ✅' ELSE 'MISSING ❌' END AS status
  FROM expected e
  LEFT JOIN pg_tables t
    ON t.tablename = e.tbl
   AND t.schemaname = current_schema()
 ORDER BY status DESC, e.tbl;

\echo ''
\echo '========== [3] 033 게이트 승인 상태 (automated_scoring) =========='
-- 게이트 행이 있고 status='approved' 인가? (없으면 fail-closed 로 차단됨)
SELECT gate_key,
       status,
       approval_reference,
       approved_by,
       approved_at
  FROM trust_compliance_gates
 WHERE gate_key = 'automated_scoring';

\echo ''
\echo '========== [4] 요약 판정 =========='
SELECT
  (SELECT count(*) FROM _migrations
     WHERE name LIKE '%028%' OR name LIKE '%029%' OR name LIKE '%033%') AS ledger_entries_of_3,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname = current_schema()
       AND tablename IN (
         'trust_organizations','trust_organization_memberships','trust_organization_api_clients',
         'contract_check_reports','contract_check_items','trust_cards','trust_card_access_logs',
         'document_intakes','ai_processing_runs','validation_experiments',
         'trust_compliance_gates','trust_compliance_gate_events'
       )) AS tables_present_of_12,
  (SELECT status FROM trust_compliance_gates WHERE gate_key = 'automated_scoring') AS automated_scoring_gate;
-- 기대값: ledger_entries_of_3 = 3, tables_present_of_12 = 12, automated_scoring_gate = 'approved'
-- 하나라도 어긋나면 → 프로덕션 미적용/불완전. db:migrate 를 "런타임 DB"에 대해 재실행 필요.
