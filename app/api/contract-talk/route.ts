import { getCurrentUser } from '@/lib/auth'
import { talkHandler } from '@/lib/contract-talk/http'
import { postgresTalkStore } from '@/lib/contract-talk/postgres'
export const dynamic = 'force-dynamic'
const handler = talkHandler(postgresTalkStore, getCurrentUser)
export async function POST(request: Request) { return handler(request) }
