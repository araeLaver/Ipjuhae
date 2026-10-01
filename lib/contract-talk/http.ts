import { Actor, TalkError } from './model'
import { TalkStore, createService } from './service'

export function enabled() { return process.env.CONTRACT_TALK_TEST_ENABLED === '1' && process.env.NODE_ENV !== 'production' }
export function talkHandler(store: TalkStore, authenticate: () => Promise<Actor | null>, isEnabled = enabled, clock = Date.now) {
  const service = createService(store, clock)
  return async (request: Request, key?: string, shared = false): Promise<Response> => {
    const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
    if (!isEnabled()) return respond({ error: '현재 사용할 수 없는 테스트 기능입니다.' }, 404)
    try {
      if (!['GET', 'POST', 'PATCH'].includes(request.method)) throw new TalkError(405, '지원하지 않는 요청입니다.')
      if (request.method !== 'GET') {
        if (request.headers.get('origin') !== new URL(request.url).origin) throw new TalkError(403, '같은 사이트에서만 변경할 수 있습니다.')
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new TalkError(415, 'JSON 요청이 필요합니다.')
      }
      const actor = await authenticate()
      if (!actor) throw new TalkError(401, '로그인이 필요합니다.')
      let data: unknown
      if (request.method === 'GET' && key) data = await service.get(actor, key, shared)
      else {
        const reader = request.body?.getReader()
        if (!reader) throw new TalkError(400, '입력 내용이 없습니다.')
        const decoder = new TextDecoder()
        let body = '', bytes = 0
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          bytes += chunk.value.length
          if (bytes > 8192) { await reader.cancel(); throw new TalkError(413, '입력 내용이 너무 깁니다.') }
          body += decoder.decode(chunk.value, { stream: true })
        }
        body += decoder.decode()
        const parsed: unknown = JSON.parse(body)
        if (request.method === 'POST' && !key) data = await service.create(actor, parsed)
        else if (request.method === 'PATCH' && key) data = await service.mutate(actor, key, shared, parsed)
        else throw new TalkError(405, '지원하지 않는 요청입니다.')
      }
      return respond({ talk: data }, request.method === 'POST' ? 201 : 200)
    } catch (error) {
      if (error instanceof TalkError) return respond({ error: error.message }, error.status)
      if (error instanceof SyntaxError) return respond({ error: '입력 형식을 확인해주세요.' }, 400)
      // 자유 입력·링크 식별자·인증정보를 로그에 남기지 않는다.
      return respond({ error: '요청을 처리하지 못했습니다.' }, 500)
    }
  }
}
