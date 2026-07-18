import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const complianceMocks = vi.hoisted(() => ({
  requireApprovedComplianceGate: vi.fn(),
}))

vi.mock('@/lib/compliance-gates', () => complianceMocks)

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('external verification compliance boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('checks the external-data gate before CODEF credentials or network access', async () => {
    vi.stubEnv('VERIFICATION_PROVIDER', 'codef')
    complianceMocks.requireApprovedComplianceGate.mockRejectedValue(
      new Error('COMPLIANCE_GATE_NOT_APPROVED'),
    )
    const { verifyEmployment } = await import('@/lib/verification')

    await expect(
      verifyEmployment('Example Corp', {
        name: 'Example User',
        birthDate: '1990-01-01',
        phoneNumber: '010-1234-5678',
      }),
    ).rejects.toThrow('COMPLIANCE_GATE_NOT_APPROVED')

    expect(complianceMocks.requireApprovedComplianceGate).toHaveBeenCalledWith(
      'external_data_access',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not silently fall back to mock verification for an unsupported provider', async () => {
    vi.stubEnv('VERIFICATION_PROVIDER', 'nice')
    const { verifyEmployment } = await import('@/lib/verification')

    const result = await verifyEmployment('Example Corp')

    expect(result).toEqual({
      success: false,
      error: 'Employment verification provider is unavailable',
    })
    expect(complianceMocks.requireApprovedComplianceGate).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
