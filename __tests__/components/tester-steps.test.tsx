// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TesterSteps } from '@/components/tester-steps'

vi.mock('@/lib/analytics-client', () => ({ track: vi.fn() }))
vi.mock('@/lib/attribution', () => ({ getAttribution: () => ({}) }))
afterEach(cleanup)

it('구글 그룹 셀프 가입(1단계)과 Google Play 테스터 참여(2단계) 링크를 순서대로 제공한다', () => {
  render(<TesterSteps />)
  const groupLink = screen.getByRole('link', { name: '1단계: 구글 그룹 참여하기' })
  const testingLink = screen.getByRole('link', { name: '2단계: 테스터로 참여하기' })
  expect(groupLink.getAttribute('href')).toBe('https://groups.google.com/g/ipjuhae-testers')
  expect(testingLink.getAttribute('href')).toBe('https://play.google.com/apps/testing/com.ipjuhae.app')
})
