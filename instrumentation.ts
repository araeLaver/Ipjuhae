export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    await runPendingMigrations()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

async function runPendingMigrations() {
  if (!process.env.DATABASE_URL) return

  try {
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
    const client = await pool.connect()

    try {
      // migration-012: landlord_references + trust score columns
      await client.query(`
        CREATE TABLE IF NOT EXISTS landlord_references (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          landlord_name VARCHAR(100),
          landlord_phone VARCHAR(20) NOT NULL,
          landlord_email VARCHAR(255),
          status VARCHAR(20) DEFAULT 'pending',
          verification_token VARCHAR(128) UNIQUE,
          token_expires_at TIMESTAMPTZ,
          request_sent_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_references_user_id ON landlord_references(user_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_references_token ON landlord_references(verification_token)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_references_status ON landlord_references(status)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_references_expires ON landlord_references(token_expires_at) WHERE status = 'sent'`)

      await client.query(`
        CREATE TABLE IF NOT EXISTS reference_responses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reference_id UUID REFERENCES landlord_references(id) ON DELETE CASCADE,
          rent_payment INT CHECK (rent_payment BETWEEN 1 AND 5),
          property_condition INT CHECK (property_condition BETWEEN 1 AND 5),
          neighbor_issues INT CHECK (neighbor_issues BETWEEN 1 AND 5),
          checkout_condition INT CHECK (checkout_condition BETWEEN 1 AND 5),
          would_recommend BOOLEAN,
          comment VARCHAR(500),
          overall_rating VARCHAR(20),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)

      await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reference_score INT DEFAULT 0`)
      await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_score INT DEFAULT 0`)
      await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_score INT DEFAULT 0`)

      // migration-013: analytics_events
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id BIGSERIAL PRIMARY KEY,
          event_name TEXT NOT NULL,
          properties JSONB DEFAULT '{}',
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          session_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC)`)

      console.log('[migration] pending migrations applied')
    } finally {
      client.release()
      await pool.end()
    }
  } catch (err) {
    // migration failure must not block server startup
    console.error('[migration] auto-migration error (non-fatal):', err)
  }
}
