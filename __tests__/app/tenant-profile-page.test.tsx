import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TenantProfilePage from '@/app/tenant/profile/page'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/lib/analytics-client', () => ({
  trackEvent: vi.fn(),
}))

describe('/tenant/profile page', () => {
  beforeEach(() => {
    push.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits the API tenant profile schema payload', async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            profile: {
              id: 'tenant-profile-1',
              user_id: 'tenant-1',
              budget_min: 30,
              budget_max: 70,
              preferred_districts: ['마포구'],
              move_in_date: '2026-08-01',
              has_pets: true,
              workplace: '강남구 IT회사',
              created_at: new Date(),
              updated_at: new Date(),
            },
          }),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ profile: null }),
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<TenantProfilePage />)

    await screen.findByText('임차인 프로필 입력')

    fireEvent.change(screen.getByPlaceholderText('최소 (예: 30)'), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByPlaceholderText('최대 (예: 60)'), {
      target: { value: '70' },
    })
    fireEvent.click(screen.getByRole('button', { name: '마포구' }))
    fireEvent.change(screen.getByLabelText('입주 희망일'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: '있음' }))
    fireEvent.change(screen.getByPlaceholderText('예: 강남구 IT회사, 종로구 공무원'), {
      target: { value: '강남구 IT회사' },
    })
    fireEvent.click(screen.getByRole('button', { name: '프로필 저장' }))

    let putCall: [string, RequestInit] | undefined
    await waitFor(() => {
      putCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT') as
        | [string, RequestInit]
        | undefined
      expect(putCall).toBeDefined()
    })

    const [url, options] = putCall!
    expect(typeof options.body).toBe('string')
    const body = JSON.parse(options.body as string)

    expect(url).toBe('/api/tenant/profile')
    expect(options.method).toBe('PUT')
    expect(body).toEqual({
      budget_min: 30,
      budget_max: 70,
      preferred_districts: ['마포구'],
      move_in_date: '2026-08-01',
      has_pets: true,
      workplace: '강남구 IT회사',
    })
    expect(body).not.toHaveProperty('preferred_region')
    expect(body).not.toHaveProperty('job_title')
    expect(body).not.toHaveProperty('company_name')
  })
})
