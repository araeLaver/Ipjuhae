/**
 * seed-matches.ts
 * Inserts 30 dummy listings + 1 test tenant for matching engine validation.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-matches.ts
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL 환경변수가 필요합니다')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
})

const DISTRICTS = ['강남구', '마포구', '용산구', '성동구', '종로구', '서초구', '영등포구', '동작구']
const RENTS = [500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_200_000, 1_500_000]
const DEPOSITS = [5_000_000, 10_000_000, 15_000_000, 20_000_000]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function run() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Seed landlord user (idempotent by email)
    const landlordRes = await client.query<{ id: number }>(
      `INSERT INTO users (email, name, role)
       VALUES ('seed-landlord@rentme.test', '시드 집주인', 'landlord')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    )
    const landlordId = landlordRes.rows[0].id
    console.log(`Landlord user id: ${landlordId}`)

    // 2. Delete existing seed listings to keep idempotent
    await client.query(
      `DELETE FROM listings WHERE landlord_id = $1`,
      [landlordId]
    )

    // 3. Insert 30 listings
    const today = new Date()
    const inserted: number[] = []

    for (let i = 0; i < 30; i++) {
      const district = randomItem(DISTRICTS)
      const monthly_rent = randomItem(RENTS)
      const deposit = randomItem(DEPOSITS)
      const available_from = addDays(today, i * 3 - 10) // spread across dates
      const pet_allowed = i % 3 === 0 ? true : i % 3 === 1 ? false : null

      const res = await client.query<{ id: number }>(
        `INSERT INTO listings
           (landlord_id, monthly_rent, deposit, address, area_sqm, floor, available_from, pet_allowed, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available')
         RETURNING id`,
        [
          landlordId,
          monthly_rent,
          deposit,
          `서울특별시 ${district} 시드로 ${i + 1}길 ${(i + 1) * 3}`,
          Math.floor(Math.random() * 40 + 20), // 20–60 sqm
          Math.floor(Math.random() * 15 + 1),  // floor 1–15
          available_from,
          pet_allowed,
        ]
      )
      inserted.push(res.rows[0].id)
    }

    console.log(`Inserted ${inserted.length} listings: ids ${inserted[0]}–${inserted[inserted.length - 1]}`)

    // 4. Seed tenant user + profile for matching test
    const tenantRes = await client.query<{ id: number }>(
      `INSERT INTO users (email, name, role)
       VALUES ('seed-tenant@rentme.test', '시드 세입자', 'tenant')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    )
    const tenantId = tenantRes.rows[0].id

    await client.query(
      `INSERT INTO tenant_profiles
         (user_id, budget_min, budget_max, preferred_districts, move_in_date, has_pets)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET budget_min = EXCLUDED.budget_min,
             budget_max = EXCLUDED.budget_max,
             preferred_districts = EXCLUDED.preferred_districts,
             move_in_date = EXCLUDED.move_in_date,
             has_pets = EXCLUDED.has_pets`,
      [
        tenantId,
        700_000,
        1_000_000,
        ['강남구', '마포구'],
        addDays(today, 7),
        false,
      ]
    )

    console.log(`Tenant user id: ${tenantId} — budget 70–100만, 강남구/마포구, no pets`)

    await client.query('COMMIT')
    console.log('✅ Seed complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
