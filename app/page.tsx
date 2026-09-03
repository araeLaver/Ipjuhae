import { Metadata } from 'next'
import { queryOne } from '@/lib/db'
import { WaitlistLanding } from '@/components/landing/waitlist-landing'

export const metadata: Metadata = {
  title: '입주해 — 믿을 만한 세입자인지, 믿을 만한 집인지. 이제 확인할 수 있습니다',
  description:
    '임차인은 증명하고, 임대인은 확인하고, 중개사는 검증합니다. 임대차 거래의 신뢰를 만드는 입주해, 지금 사전 신청하고 얼리 혜택을 받으세요.',
  openGraph: {
    title: '입주해 — 믿을 만한 세입자인지, 믿을 만한 집인지. 이제 확인할 수 있습니다',
    description:
      '임차인은 증명하고, 임대인은 확인하고, 중개사는 검증합니다. 지금 사전 신청하고 얼리 혜택을 받으세요.',
  },
}

export const revalidate = 60

async function getWaitlistCount(): Promise<number> {
  try {
    const row = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM waitlist')
    return parseInt(row?.count ?? '0', 10)
  } catch {
    return 0
  }
}

export default async function LandingPage() {
  const count = await getWaitlistCount()
  return <WaitlistLanding initialCount={count} />
}
