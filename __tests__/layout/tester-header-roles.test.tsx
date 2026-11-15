// @vitest-environment jsdom
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Header } from '@/components/layout/header'

vi.mock('next/navigation', () => ({ usePathname: () => '/community', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }))
vi.mock('@/components/layout/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/notifications/notification-center', () => ({ NotificationCenter: () => null }))
afterEach(cleanup)

test('동일 Header 인스턴스에서 역할 변경 시 모집 링크가 유지되고 중복되지 않음', () => {
  const { container, rerender } = render(<Header user={null} />)
  for (const role of [null, 'tenant', 'landlord', 'broker', 'admin', null] as const) {
    rerender(<Header user={role ? { email: 'qa@example.com', userType: role } : null} />)
    const links = container.querySelectorAll('header nav a[href="/tester?from=header"]')
    expect(links.length).toBe(1)
    expect(links[0].textContent).toBe('앱 테스터 참여')
  }
})
