import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAdminUser } from '@/lib/admin'
import { buildPrintableContractReport } from '@/lib/contract-trust'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const admin = await getAdminUser()
  const { id } = await context.params
  try {
    const html = await buildPrintableContractReport(user.id, id, Boolean(admin))
    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': 'inline; filename="contract-check-report.html"',
        'cache-control': 'private, no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CONTRACT_REPORT_PRINT_FAILED'
    return NextResponse.json({ error: code }, { status: code.endsWith('NOT_FOUND') ? 404 : 500 })
  }
}

