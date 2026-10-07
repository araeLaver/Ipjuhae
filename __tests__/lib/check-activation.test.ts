import { expect, it } from 'vitest'
import { depositGuidePath } from '@/lib/check-activation'
import { resolveAnonymousProperties } from '@/lib/analytics-events'
it('routes fixed guide episodes and rejects unexpected titles', () => {
  expect(depositGuidePath('등기부 뜯어보기 3화. 근저당과 순위')).toBe('/guides/deungi/3')
  expect(depositGuidePath('등기부 뜯어보기 13화. 잘못된 글')).toBe('/community')
})
it('allows only fixed next actions and strips identifying payloads', () => {
  expect(resolveAnonymousProperties('check_next_action_clicked', { action: 'ask', deposit: 30000, user_id: 'secret' })).toEqual({ action: 'ask' })
  expect(resolveAnonymousProperties('check_next_action_clicked', { action: 'email@example.com' })).toEqual({})
  expect(resolveAnonymousProperties('check_started', { action: 'ask', session_id: 'secret', surface: 'web' })).toEqual({ surface: 'web' })
})
