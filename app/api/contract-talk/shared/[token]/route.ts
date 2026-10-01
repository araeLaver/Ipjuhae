import { getCurrentUser } from '@/lib/auth'
import { talkHandler } from '@/lib/contract-talk/http'
import { postgresTalkStore } from '@/lib/contract-talk/postgres'
const handler = talkHandler(postgresTalkStore, getCurrentUser)
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{token:string}> }) { return handler(request, (await params).token, true) }
export const PATCH = GET
