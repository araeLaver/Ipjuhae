// @vitest-environment jsdom
import React from 'react'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TextEncoder } from 'node:util'

let dir: string
let TrustCenterScreen: React.ComponentType<any>

const api = {
  fetchDataScore: vi.fn(),
  fetchTrustCards: vi.fn(),
  revokeTrustCard: vi.fn(),
  fetchTrustReport: vi.fn(),
  fetchMyViewAuditLogs: vi.fn(),
}

const authUser = {
  current: { userType: 'tenant', name: '임차인QA', id: 'tenant-1' } as Record<string, unknown> | null,
}

const alertSpy = vi.fn()
const state = globalThis as typeof globalThis & {
  __trustCenterQA: typeof api
  __trustCenterQAUser: typeof authUser
  __trustCenterAlert: typeof alertSpy
}

beforeAll(async () => {
  class Encoder extends TextEncoder {
    encode(input = '') {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = Encoder as typeof globalThis.TextEncoder
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-mobile-trust-center-'))

  const native = join(dir, 'native.js')
  writeFileSync(
    native,
    `import React from 'react';
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : (s || {});
const element = tag => ({children, style, onPress, disabled}) => React.createElement(tag, {style: flatten(style), onClick: onPress, disabled}, children);
export const View = element('div');
export const Text = element('span');
export const TouchableOpacity = element('button');
export const ScrollView = element('div');
export const ActivityIndicator = () => React.createElement('progress');
export const RefreshControl = ({onRefresh}) => React.createElement('button', {onClick: onRefresh}, '새로고침');
export const StyleSheet = { create: s => s };
export const Alert = { alert: (...args) => globalThis.__trustCenterAlert(...args) };
export const Linking = { openURL: () => Promise.resolve() };
`
  )

  const navigation = join(dir, 'navigation.js')
  writeFileSync(
    navigation,
    `import React from 'react'; export const useFocusEffect = fn => React.useEffect(() => fn(), [fn]);`
  )

  const apiMock = join(dir, 'api.js')
  writeFileSync(
    apiMock,
    `export const fetchDataScore = (...a) => globalThis.__trustCenterQA.fetchDataScore(...a);
export const fetchTrustCards = (...a) => globalThis.__trustCenterQA.fetchTrustCards(...a);
export const revokeTrustCard = (...a) => globalThis.__trustCenterQA.revokeTrustCard(...a);
export const fetchTrustReport = (...a) => globalThis.__trustCenterQA.fetchTrustReport(...a);
export const fetchMyViewAuditLogs = (...a) => globalThis.__trustCenterQA.fetchMyViewAuditLogs(...a);
`
  )

  const authMock = join(dir, 'auth.js')
  writeFileSync(
    authMock,
    `export const useAuth = () => ({ user: globalThis.__trustCenterQAUser.current });`
  )

  const plugin = {
    name: 'mobile-trust-center-qa',
    setup(b: any) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: native }))
      b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: navigation }))
      b.onResolve({ filter: /^\.\.\/services\/api$/ }, () => ({ path: apiMock }))
      b.onResolve({ filter: /^\.\.\/contexts\/AuthContext$/ }, () => ({ path: authMock }))
    },
  }

  await build({
    entryPoints: ['mobile/src/screens/TrustCenterScreen.tsx'],
    bundle: true,
    format: 'esm',
    jsx: 'automatic',
    outdir: dir,
    external: ['react', 'react/jsx-runtime'],
    plugins: [plugin],
  })

  TrustCenterScreen = (await import(pathToFileURL(join(dir, 'TrustCenterScreen.js')).href)).default
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  state.__trustCenterQA = api
  state.__trustCenterQAUser = authUser
  state.__trustCenterAlert = alertSpy
  authUser.current = { userType: 'tenant', name: '임차인QA', id: 'tenant-1' }
})

afterEach(() => {
  cleanup()
})

const nav = { navigate: vi.fn() }

describe('Mobile TrustCenterScreen (Patent DATA SCORE + Trust Card + Audit)', () => {
  it('renders DATA SCORE dimensions, Trust Cards, and revokes an issued card upon confirmation', async () => {
    api.fetchDataScore.mockResolvedValue({
      score: 84,
      modelVersion: 'data-score-pilot-1.0',
      dimensions: {
        clarity: 0.9,
        completeness: 0.83,
        recency: 1,
        consistency: 0.75,
        verifiability: 0.72,
      },
      factCount: 5,
    })
    api.fetchTrustCards.mockResolvedValue([
      {
        id: 'card-1',
        title: '강남구 역삼동 전세 검증카드',
        reportTitle: '계약 전 확인 리포트',
        audienceRole: 'landlord',
        purpose: '계약 전 소득·재직 최소확인',
        status: 'issued',
        tokenPrefix: 'abc12345',
        allowedViews: 2,
        expiresAt: '2026-12-31T00:00:00.000Z',
        createdAt: '2026-11-27T00:00:00.000Z',
      },
    ])
    api.fetchTrustReport.mockResolvedValue({
      facts: [
        {
          id: 'fact-1',
          fieldName: 'employment_verified',
          status: 'CONFIRMED',
          quality: 0.95,
          validUntil: '2027-01-01T00:00:00.000Z',
        },
      ],
      disclosures: [
        {
          id: 'disc-1',
          policyVersion: 'v1.0',
          claimKeys: ['employment_verified', 'income_band'],
          state: 'ISSUED',
          expiresAt: '2026-12-10T00:00:00.000Z',
        },
      ],
      scoringDeferred: false,
    })
    api.fetchMyViewAuditLogs.mockResolvedValue([
      {
        id: 'log-1',
        targetType: 'tenant_profile',
        purpose: '계약 검토',
        granted: true,
        createdAt: '2026-11-27T01:00:00.000Z',
      },
    ])
    api.revokeTrustCard.mockResolvedValue(undefined)

    render(<TrustCenterScreen navigation={nav} />)

    await waitFor(() => {
      expect(screen.getByText('84')).toBeTruthy()
    })

    expect(screen.getByText('강남구 역삼동 전세 검증카드')).toBeTruthy()
    expect(screen.getByText('재직 확인')).toBeTruthy()

    // Trigger instant revoke and confirm alert
    fireEvent.click(screen.getByText('즉시 회수 (접근 차단)'))
    expect(alertSpy).toHaveBeenCalledTimes(1)
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => Promise<void> }>
    const confirmBtn = buttons.find((b) => b.text === '즉시 회수')
    expect(confirmBtn?.onPress).toBeTruthy()
    await act(async () => {
      await confirmBtn!.onPress!()
    })
    expect(api.revokeTrustCard).toHaveBeenCalledWith('card-1')

    // Switch to Audit tab
    fireEvent.click(screen.getByText('열람 로그 (1)'))
    expect(screen.getByText('계약 검토')).toBeTruthy()
    expect(screen.getByText('허용')).toBeTruthy()
  })

  it('shows a retry error banner instead of pretending empty on load failure', async () => {
    api.fetchDataScore.mockRejectedValue(new Error('network down'))
    api.fetchTrustCards.mockResolvedValue([])
    api.fetchTrustReport.mockResolvedValue({ facts: [], disclosures: [], scoringDeferred: false })
    api.fetchMyViewAuditLogs.mockResolvedValue([])

    render(<TrustCenterScreen navigation={nav} />)

    await waitFor(() => {
      expect(screen.getByText('신뢰센터 정보를 불러오지 못했습니다')).toBeTruthy()
    })

    api.fetchDataScore.mockResolvedValue({
      score: 70,
      modelVersion: 'data-score-pilot-1.0',
      dimensions: { clarity: 0.7, completeness: 0.7, recency: 0.7, consistency: 0.7, verifiability: 0.7 },
      factCount: 3,
    })
    fireEvent.click(screen.getByText('다시 시도'))

    await waitFor(() => {
      expect(screen.getByText('70')).toBeTruthy()
    })
  })

  it('skips DATA SCORE fetch gracefully for broker accounts', async () => {
    authUser.current = { userType: 'broker', name: '중개사QA', id: 'broker-1' }
    api.fetchTrustCards.mockResolvedValue([])
    api.fetchTrustReport.mockResolvedValue({ facts: [], disclosures: [], scoringDeferred: false })
    api.fetchMyViewAuditLogs.mockResolvedValue([])

    render(<TrustCenterScreen navigation={nav} />)

    await waitFor(() => {
      expect(
        screen.getByText('DATA SCORE는 임차인·임대인 계정의 증빙 자료를 기준으로 산출됩니다.')
      ).toBeTruthy()
    })
    expect(api.fetchDataScore).not.toHaveBeenCalled()
  })
})
