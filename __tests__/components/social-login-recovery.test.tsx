// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useSearchParams: () => navigation.params }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/components/layout/header', () => ({ Header: () => null }))
vi.mock('@/lib/supabase', () => ({ createBrowserClient: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import LoginPage from '@/app/login/page'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'
beforeEach(() => {
  navigation.params = new URLSearchParams({ error: 'oauth_unavailable', redirect: '/community/abc?tab=latest' })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ providers: [] })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
it('지속 상태 안내에서 비밀번호 모드와 이메일 포커스를 복구한다', async () => {
  render(<LoginPage />)
  expect(screen.getByRole('status').textContent).toContain('소셜 로그인을 사용할 수 없습니다')
  expect(screen.getByRole('status').textContent).toContain('이메일과 비밀번호로 가입한 계정이 없다면')
  fireEvent.click(screen.getByRole('button', { name: '매직 링크로 로그인' }))
  fireEvent.click(screen.getByRole('button', { name: '이메일로 로그인' }))
  expect(screen.getByLabelText('비밀번호')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('이메일')))
})
it.each(['/community/abc?tab=latest', '//evil.example'])('복구 후 이메일 로그인 목적지를 검증한다: %s', async (redirect) => {
  navigation.params.set('redirect', redirect)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url === '/api/auth/login' ? { user: { user_type: 'tenant' } } : { providers: [] })))
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'fixture@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'fixture-password' } })
  fireEvent.submit(screen.getByRole('button', { name: /^로그인$/ }).closest('form')!)
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(redirect.startsWith('//') ? '/profile' : redirect))
})
it.each(['login', 'signup'] as const)('%s에서 비활성 수단과 전용 구분선을 숨긴다', async (mode) => {
  const { container } = render(<SocialLoginButtons mode={mode} />)
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(container.textContent).toBe('')
})
