import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SAMPLE_COMPLEXES, SAMPLE_SOURCE_AS_OF, SAMPLE_TRANSACTIONS } from '@/fixtures/rental-risk-sample'
import { createRentalRiskBrief } from '@/lib/rental-risk'

const inputSchema = z.object({
  address: z.string().trim().min(1).max(200),
  complexName: z.string().trim().min(1).max(100),
  areaM2: z.number().positive().max(1000),
  depositManwon: z.number().int().nonnegative(),
  monthlyRentManwon: z.number().int().nonnegative(),
})

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '입력 형식이 올바르지 않습니다', details: parsed.error.flatten() }, { status: 400 })
  }

  return NextResponse.json(createRentalRiskBrief({
    input: parsed.data,
    complexes: SAMPLE_COMPLEXES,
    transactions: SAMPLE_TRANSACTIONS,
    sourceAsOf: SAMPLE_SOURCE_AS_OF,
  }))
}

