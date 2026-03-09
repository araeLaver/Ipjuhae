import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const checks: Record<string, string> = {
    app: 'ok',
    database: 'unknown',
  }

  try {
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
      checks.database = 'ok'
    } finally {
      client.release()
    }
  } catch {
    checks.database = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
