import { notFound } from 'next/navigation'
import { enabled } from '@/lib/contract-talk/http'
import { TalkDetail } from '@/components/contract-talk/talk-client'
export const dynamic = 'force-dynamic'
export const metadata = { title: '계약 전 대화 확인', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function Page({params}:{params:Promise<{id:string}>}) { if (!enabled()) notFound(); return <TalkDetail key={(await params).id} id={(await params).id} /> }
