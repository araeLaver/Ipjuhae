import pg from 'pg'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const schema = process.env.DB_SCHEMA || 'ipjuhae'
const pool = new Pool({ connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } })

const requiredTables = [
  'trust_evidence_nodes', 'trust_fact_nodes', 'trust_derived_nodes', 'trust_dependency_edges',
  'trust_score_models', 'trust_score_runs', 'trust_disclosure_packages', 'trust_transaction_contexts',
  'trust_tenancy_relationships', 'trust_reference_submissions', 'trust_graph_edges', 'trust_review_tasks',
  'trust_extraction_jobs', 'trust_outbox_events', 'trust_retention_actions', 'trust_delivery_receipts',
]

async function run() {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${schema}, public`)
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2::text[])`, [schema, requiredTables])
    const found = new Set(tables.rows.map((row) => row.table_name))
    const missing = requiredTables.filter((table) => !found.has(table))
    if (missing.length) throw new Error(`Missing trust tables: ${missing.join(', ')}`)
    const migrations = await client.query(`SELECT name FROM _migrations WHERE name LIKE 'migration-02%-trust-%' OR name = 'migration-026-evidence-fact-cascade.sql' ORDER BY name`)
    const models = await client.query(`SELECT subject_type, COUNT(*)::int AS count FROM trust_score_models WHERE status = 'active' GROUP BY subject_type`)
    const policies = await client.query(`SELECT COUNT(*)::int AS count FROM trust_disclosure_policies WHERE status = 'active'`)
    const triggers = await client.query(`SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = $1 AND trigger_name IN ('link_trust_evidence_to_fact','stale_trust_facts_on_evidence_change','revoke_trust_disclosures_on_consent_change')`, [schema])
    if (models.rows.length !== 3) throw new Error('Expected active tenant, landlord and property models')
    if (policies.rows[0].count < 4) throw new Error('Expected minimum disclosure policies')
    if (triggers.rows.length !== 3) throw new Error('Expected trust cascade triggers')
    console.log(JSON.stringify({ ok: true, tables: found.size, migrations: migrations.rows.map((row) => row.name), models: models.rows, policies: policies.rows[0].count, triggers: triggers.rows.map((row) => row.trigger_name) }))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(async (error) => { console.error(error); await pool.end().catch(() => {}); process.exit(1) })

