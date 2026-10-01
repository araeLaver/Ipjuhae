import { z } from 'zod'
import { Action, Actor, Talk, TalkError, active, actionSchema, applyAction, createSchema, createTalk, view } from './model'

export interface TalkStore {
  create(talk: Talk): Promise<Talk>
  find(key: string, shared: boolean): Promise<Talk | null>
  update(key: string, shared: boolean, fn: (talk: Talk) => Talk): Promise<Talk>
}
export function createService(store: TalkStore, clock = Date.now) {
  return {
    async create(actor: Actor | null, input: unknown) {
      if (!actor) throw new TalkError(401, '로그인이 필요합니다.')
      const parsed = createSchema.safeParse(input)
      if (!parsed.success) throw new TalkError(400, '가능한 시간 1~3개를 확인해주세요.')
      const stored = await store.create(createTalk(actor, parsed.data, clock()))
      active(stored, clock())
      return view(stored, actor, false, clock())
    },
    async get(actor: Actor | null, key: string, shared: boolean) {
      if (!actor) throw new TalkError(401, '로그인이 필요합니다.')
      if (!(shared ? /^[a-f0-9]{64}$/.test(key) : z.string().uuid().safeParse(key).success)) throw new TalkError(404, '잘못된 요청 링크입니다.')
      const talk = await store.find(key, shared)
      if (!talk) throw new TalkError(404, '요청을 찾을 수 없습니다.')
      return view(talk, actor, shared, clock())
    },
    async mutate(actor: Actor | null, key: string, shared: boolean, input: unknown) {
      if (!actor) throw new TalkError(401, '로그인이 필요합니다.')
      const parsed = z.object({ version: z.number().int().positive(), change: actionSchema }).strict().safeParse(input)
      if (!parsed.success) throw new TalkError(400, '변경 내용을 확인해주세요.')
      // get으로 링크 형식/권한을 먼저 확인하고 실제 변경에서도 같은 검사를 반복한다.
      await this.get(actor, key, shared)
      const talk = await store.update(key, shared, t => applyAction(t, actor, shared, parsed.data.version, parsed.data.change, clock()))
      return view(talk, actor, false, clock())
    },
  }
}
export class MemoryTalkStore implements TalkStore {
  private records = new Map<string, Talk>()
  async create(t: Talk) {
    const existing = [...this.records.values()].find(r => r.ownerId === t.ownerId && r.clientKey === t.clientKey)
    if (existing) {
      if (JSON.stringify(existing.slots) !== JSON.stringify(t.slots) || existing.recipientHash !== t.recipientHash) throw new TalkError(409, '같은 생성 요청의 내용이 다릅니다.')
      return structuredClone(existing)
    }
    // 로컬 서버 메모리가 무한히 커지지 않도록 상한을 둔다.
    if (this.records.size >= 500 || [...this.records.values()].filter(r => r.ownerId === t.ownerId).length >= 50) throw new TalkError(429, '테스트 요청 한도에 도달했습니다.')
    this.records.set(t.id, structuredClone(t))
    return structuredClone(t)
  }
  async find(key: string, shared: boolean) {
    const t = shared ? [...this.records.values()].find(r => r.shareId === key) : this.records.get(key)
    return t ? structuredClone(t) : null
  }
  async update(key: string, shared: boolean, fn: (talk: Talk) => Talk) {
    // find의 await 사이에 갱신이 끼지 않도록 조회·검사·저장을 동기 구간에서 처리한다.
    const t = shared ? [...this.records.values()].find(r => r.shareId === key) : this.records.get(key)
    if (!t) throw new TalkError(404, '요청을 찾을 수 없습니다.')
    const next = fn(structuredClone(t))
    this.records.set(next.id, structuredClone(next))
    return structuredClone(next)
  }
}
export type TalkView = ReturnType<typeof view>
export type { Action, Actor }
