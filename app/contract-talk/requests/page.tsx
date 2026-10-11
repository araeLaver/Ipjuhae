import {notFound} from 'next/navigation'
import {enabled} from '@/lib/contract-talk/http'
import {TalkInbox} from '@/components/contract-talk/talk-client'
export const dynamic='force-dynamic'
export const metadata={title:'보낸·받은 대화 요청',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default function Page(){if(!enabled())notFound();return <TalkInbox />}
