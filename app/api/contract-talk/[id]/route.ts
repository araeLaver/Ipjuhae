import { getCurrentUser } from '@/lib/auth'
import { talkHandler } from '@/lib/contract-talk/http'
import { postgresTalkStore } from '@/lib/contract-talk/postgres'
const handler = talkHandler(postgresTalkStore, getCurrentUser)
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) { return handler(request, (await params).id) }
export const PATCH = GET
