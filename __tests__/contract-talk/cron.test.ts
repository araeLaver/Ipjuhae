import {beforeEach,describe,it,expect,vi} from 'vitest'
const {query}=vi.hoisted(()=>({query:vi.fn()}))
vi.mock('@/lib/db',()=>({query}))
import {GET} from '@/app/api/cron/contract-talk/route'
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CRON_SECRET','test-cron-only')})
describe('계약 전 대화 전용 보존 정리',()=>{
 it('기존 cron 인증 없이는 DB를 호출하지 않는다',async()=>{expect((await GET(new Request('http://localhost/api/cron/contract-talk'))).status).toBe(401);expect(query).not.toHaveBeenCalled()})
 it('이 기능의 만료 30일 지난 행만 한정적으로 정리한다',async()=>{query.mockResolvedValue([{count:'2'}]);const r=await GET(new Request('http://localhost/api/cron/contract-talk',{headers:{authorization:'Bearer test-cron-only'}}));expect(await r.json()).toEqual({ok:true,deleted:2});expect(query.mock.calls[0][0]).toContain("expires_at < NOW() - interval '30 days'");expect(query.mock.calls[0][0]).toContain('LIMIT 5000');expect(query.mock.calls[0][0]).not.toContain('users')})
})
