import { notFound } from 'next/navigation'
import { enabled } from '@/lib/contract-talk/http'
import { CreateTalk } from '@/components/contract-talk/talk-client'
export const dynamic = 'force-dynamic'
export const metadata = { title: '계약 전 대화 요청 · 로컬 테스트', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default function Page() { if (!enabled()) notFound(); return <CreateTalk /> }
