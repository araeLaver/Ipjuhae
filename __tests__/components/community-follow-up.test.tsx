// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FollowUpQuestions } from '@/components/community/follow-up-questions'
import { QUESTION_KEY, rememberQuestion } from '@/lib/community-follow-up'
const id='10000000-0000-4000-8000-000000000001'
beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => {cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()})
it('restores the question link and refreshes a newly posted operator reply', async () => {
  expect(rememberQuestion(id)).toBe(true)
  let answered=false
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({posts:[{id,title:'내 질문',has_operator_reply:answered}]}))))
  render(<FollowUpQuestions />)
  await screen.findByText('운영자 답변 대기')
  expect(screen.getByRole('link',{name:'내 질문'}).getAttribute('href')).toBe(`/community/${id}`)
  answered=true;fireEvent.click(screen.getByRole('button',{name:'답변 상태 새로고침'}))
  await screen.findByText('운영자 답변 있음')
})
it('shows a query error rather than claiming no saved questions', async () => {
  rememberQuestion(id)
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:500})))
  render(<FollowUpQuestions />)
  await screen.findByRole('alert')
  expect(screen.queryByText(/보관한 질문이 없습니다/)).toBeNull()
})
it('clears links only after confirmation without a server delete', async () => {
  rememberQuestion(id)
  const fetch=vi.fn(async(_url: string, _options?: RequestInit)=>new Response(JSON.stringify({posts:[]})))
  vi.stubGlobal('fetch',fetch)
  render(<FollowUpQuestions />)
  await waitFor(()=>expect(screen.getByRole('button',{name:'답변 상태 새로고침'}).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'이 기기 목록 비우기'}))
  expect(localStorage.getItem(QUESTION_KEY)).not.toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'링크 목록 지우기'}))
  expect(localStorage.getItem(QUESTION_KEY)).toBeNull()
  expect(fetch.mock.calls.every(([,options])=>!options?.method || options.method==='GET')).toBe(true)
})
it('does not overwrite broken storage when remembering a question', () => {
  localStorage.setItem(QUESTION_KEY,'{broken')
  expect(rememberQuestion(id)).toBe(false)
  expect(localStorage.getItem(QUESTION_KEY)).toBe('{broken')
})
