import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401})
 try{
  const [result]=await query<{count:string}>(`WITH deleted AS (
   DELETE FROM contract_talk_requests WHERE id IN
   (SELECT id FROM contract_talk_requests WHERE expires_at < NOW() - interval '30 days' LIMIT 5000)
   RETURNING id) SELECT count(*)::text AS count FROM deleted`)
  return NextResponse.json({ok:true,deleted:Number(result?.count??0)},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Cleanup unavailable'},{status:503})}
}
