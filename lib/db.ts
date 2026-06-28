import { Pool, PoolClient } from 'pg'

const isProduction = process.env.NODE_ENV === 'production'
const DB_SCHEMA = getSafeSchemaName(process.env.DB_SCHEMA || 'ipjuhae')

function getSafeSchemaName(schema: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('DB_SCHEMA 환경변수가 유효한 PostgreSQL 스키마명이 아닙니다')
  }
  return schema
}

function isLocalDatabaseUrl(databaseUrl?: string): boolean {
  if (!databaseUrl) return false

  try {
    const hostname = new URL(databaseUrl).hostname
    return ['localhost', '127.0.0.1', '::1', 'db'].includes(hostname)
  } catch {
    return databaseUrl.includes('localhost')
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabaseUrl(process.env.DATABASE_URL)
    ? false
    : { rejectUnauthorized: isProduction },
  options: `-c search_path=${DB_SCHEMA},public`,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
})

export default pool

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

/**
 * 트랜잭션 헬퍼: 여러 쿼리를 원자적으로 실행
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
