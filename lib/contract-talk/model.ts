import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'

import { QUESTIONS } from './prompts'
export { QUESTIONS } from './prompts'
export type Role = 'tenant' | 'landlord'
export type Actor = { id: string; user_type: string }
export type Talk = {
  id: string; shareId: string; ownerId: string; respondentId: string | null
  clientKey: string; slots: string[]; answers: string[]; proposedTime: string | null; timeAccepted: boolean
  accepted: Record<Role, boolean[]>; needsCheck: Record<Role, boolean[]>
  conversationDone: Record<Role, boolean>; confirmed: Record<Role, boolean>
  version: number; expiresAt: string; cancelled: boolean
}
export class TalkError extends Error { constructor(public status: number, message: string) { super(message) } }
export const createSchema = z.object({ clientKey: z.string().uuid(), slots: z.array(z.string().datetime()).min(1).max(3) }).strict()
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('respond'), answers: z.array(z.string().trim().max(500)).length(3), proposedTime: z.string().datetime().nullable() }).strict(),
  z.object({ action: z.literal('edit'), slots: z.array(z.string().datetime()).min(1).max(3) }).strict(),
  z.object({ action: z.literal('accept'), index: z.number().int().min(0).max(2), value: z.boolean() }).strict(),
  z.object({ action: z.literal('check'), index: z.number().int().min(0).max(2), value: z.boolean() }).strict(),
  z.object({ action: z.literal('accept_time'), value: z.boolean() }).strict(),
  z.object({ action: z.literal('conversation_done') }).strict(),
  z.object({ action: z.literal('confirm') }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
])
export type Action = z.infer<typeof actionSchema>
const blank = (): Record<Role, boolean[]> => ({ tenant: [false, false, false], landlord: [false, false, false] })
export function validateTimes(slots: string[], now: number) {
  if (new Set(slots).size !== slots.length || slots.some(t => Date.parse(t) <= now || Date.parse(t) > now + 30 * 86400000)) throw new TalkError(400, '시간은 지금부터 30일 이내의 서로 다른 일정으로 선택해주세요.')
}
export function createTalk(actor: Actor, input: z.infer<typeof createSchema>, now = Date.now()): Talk {
  if (actor.user_type !== 'tenant') throw new TalkError(403, '임차인만 요청을 만들 수 있습니다.')
  validateTimes(input.slots, now)
  return { id: randomUUID(), shareId: randomBytes(32).toString('hex'), ownerId: actor.id, respondentId: null, ...input, answers: ['', '', ''], proposedTime: null, timeAccepted: false, accepted: blank(), needsCheck: blank(), conversationDone: { tenant: false, landlord: false }, confirmed: { tenant: false, landlord: false }, version: 1, expiresAt: new Date(now + 7 * 86400000).toISOString(), cancelled: false }
}
export function roleFor(talk: Talk, actor: Actor, shared: boolean): Role {
  if (actor.id === talk.ownerId && actor.user_type === 'tenant') return 'tenant'
  if (actor.user_type === 'landlord' && (actor.id === talk.respondentId || (shared && talk.respondentId === null))) return 'landlord'
  throw new TalkError(404, '요청을 찾을 수 없거나 접근할 수 없습니다.')
}
export function active(talk: Talk, now: number) {
  if (talk.cancelled || Date.parse(talk.expiresAt) <= now) throw new TalkError(410, talk.cancelled ? '취소된 요청입니다.' : '만료된 요청입니다.')
}
export function canConfirm(t: Talk) {
  return Boolean(t.respondentId) && t.answers.every((a, i) => a && t.accepted.tenant[i] && t.accepted.landlord[i] && !t.needsCheck.tenant[i] && !t.needsCheck.landlord[i]) && (!t.proposedTime || t.timeAccepted) && t.conversationDone.tenant && t.conversationDone.landlord
}
export function progress(t: Talk): 'requested' | 'responded' | 'conversation_completed' | 'confirmed' {
  if (t.confirmed.tenant && t.confirmed.landlord) return 'confirmed'
  if (t.conversationDone.tenant && t.conversationDone.landlord) return 'conversation_completed'
  return t.respondentId ? 'responded' : 'requested'
}
export function applyAction(original: Talk, actor: Actor, shared: boolean, version: number, action: Action, now = Date.now()): Talk {
  const role = roleFor(original, actor, shared)
  active(original, now)
  if (version !== original.version) throw new TalkError(409, '다른 창에서 내용이 바뀌었습니다. 새 내용을 확인한 뒤 다시 진행해주세요.')
  const t = structuredClone(original)
  if (action.action === 'cancel') {
    if (role !== 'tenant') throw new TalkError(403, '요청자만 취소할 수 있습니다.')
    t.cancelled = true
  } else {
    if (progress(t) === 'confirmed') throw new TalkError(409, '확인 완료된 기록은 수정할 수 없습니다.')
    if (action.action === 'respond') {
      if (role !== 'landlord') throw new TalkError(403, '임대인만 답변할 수 있습니다.')
      if (t.conversationDone.tenant || t.conversationDone.landlord) throw new TalkError(409, '대화 완료 표시 후에는 답변을 수정할 수 없습니다.')
      if (!action.answers.some(Boolean) && !action.proposedTime) throw new TalkError(400, '답변이나 시간 제안을 하나 이상 남겨주세요.')
      if (action.proposedTime) validateTimes([action.proposedTime], now)
      t.respondentId = actor.id
      t.answers = action.answers
      if (t.proposedTime !== action.proposedTime) t.timeAccepted = false
      t.proposedTime = action.proposedTime
      t.accepted = blank()
      t.confirmed = { tenant: false, landlord: false }
    } else if (action.action === 'edit') {
      if (role !== 'tenant') throw new TalkError(403, '요청자만 일정을 수정할 수 있습니다.')
      if (t.respondentId) throw new TalkError(409, '상대 응답 후에는 요청 일정을 수정할 수 없습니다.')
      validateTimes(action.slots, now)
      t.slots = action.slots
    } else {
      if (!t.respondentId) throw new TalkError(409, '상대 응답 후에 진행할 수 있습니다.')
      if (action.action === 'accept' || action.action === 'check') {
        if (action.action === 'accept' && !t.answers[action.index]) throw new TalkError(409, '답변이 아직 없습니다.')
        t[action.action === 'accept' ? 'accepted' : 'needsCheck'][role][action.index] = action.value
        t.confirmed = { tenant: false, landlord: false }
      } else if (action.action === 'accept_time') {
        if (role !== 'tenant' || !t.proposedTime) throw new TalkError(403, '요청자가 제안된 시간을 확인할 수 있습니다.')
        if (action.value) validateTimes([t.proposedTime], now)
        t.timeAccepted = action.value
        t.confirmed = { tenant: false, landlord: false }
      } else if (action.action === 'conversation_done') {
        t.conversationDone[role] = true
      } else if (action.action === 'confirm') {
        if (!canConfirm(t)) throw new TalkError(409, '양측 대화 완료, 답변 합의 및 추가 확인 해소가 먼저 필요합니다.')
        t.confirmed[role] = true
      }
    }
  }
  t.version++
  return t
}
export function view(t: Talk, actor: Actor, shared: boolean, now = Date.now()) {
  const role = roleFor(t, actor, shared)
  if (role === 'landlord') active(t, now)
  const { ownerId: _owner, respondentId: _respondent, clientKey: _key, shareId, ...data } = t
  return { ...data, shareId: role === 'tenant' ? shareId : undefined, questions: QUESTIONS, viewerRole: role, progress: progress(t), canConfirm: canConfirm(t), inactive: t.cancelled || Date.parse(t.expiresAt) <= now }
}
