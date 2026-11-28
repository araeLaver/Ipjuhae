// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistryAlertCta } from '@/components/tools/registry-alert-cta'

describe('RegistryAlertCta conversion hook', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('submits email with tool attribution to POST /api/waitlist and shows confirmation count', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ message: '신청이 완료되었습니다', count: 42 }),
    })

    render(<RegistryAlertCta sourceTag="check_result" />)

    fireEvent.click(screen.getByText('임대인(집주인)'))
    fireEvent.change(screen.getByLabelText('알림 받을 이메일 주소'), {
      target: { value: 'founder@example.com' },
    })
    fireEvent.click(screen.getByText('무료 베타 알림 받기'))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('42명 대기 중')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/waitlist',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'founder@example.com',
          user_type: 'landlord',
          consent: true,
          utm_source: 'check_result',
          utm_medium: 'tool_result_cta',
          utm_campaign: 'registry_alert_beta',
        }),
      })
    )
  })

  it('handles duplicate email 409 gracefully as already registered', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: '이미 신청하신 이메일입니다' }),
    })

    render(<RegistryAlertCta sourceTag="hug_check" />)

    fireEvent.change(screen.getByLabelText('알림 받을 이메일 주소'), {
      target: { value: 'dup@example.com' },
    })
    fireEvent.click(screen.getByText('무료 베타 알림 받기'))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('이미 사전 알림 신청이 완료된 이메일')
    })
  })
})
