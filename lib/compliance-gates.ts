import { queryOne } from '@/lib/db'
import type { PoolClient } from 'pg'

export const COMPLIANCE_GATE_KEYS = [
  'production_ocr',
  'external_data_access',
  'automated_scoring',
  'paid_pilot',
  'b2b_api',
  'electronic_signature',
] as const

export type ComplianceGateKey = (typeof COMPLIANCE_GATE_KEYS)[number]
export type ComplianceGateStatus = 'pending' | 'approved' | 'blocked'
export type ComplianceGateErrorCode =
  | 'COMPLIANCE_GATE_NOT_APPROVED'
  | 'COMPLIANCE_GATE_UNAVAILABLE'

interface ComplianceGateRow {
  gate_key: string
  status: string
  approval_reference: string | null
  approved_by: string | null
  approved_at: Date | string | null
}

export class ComplianceGateError extends Error {
  readonly code: ComplianceGateErrorCode
  readonly gateKey: ComplianceGateKey

  constructor(gateKey: ComplianceGateKey, code: ComplianceGateErrorCode) {
    super(code)
    this.name = 'ComplianceGateError'
    this.code = code
    this.gateKey = gateKey
  }
}

export function isComplianceGateError(error: unknown): error is ComplianceGateError {
  return error instanceof ComplianceGateError
}

function hasCompleteApproval(row: ComplianceGateRow): boolean {
  return (
    row.status === 'approved' &&
    Boolean(row.approval_reference?.trim()) &&
    Boolean(row.approved_by) &&
    Boolean(row.approved_at)
  )
}

/**
 * Only a fully evidenced approval enables an operational capability.
 *
 * Missing rows, incomplete approval metadata, unknown states, and database
 * failures all fail closed. Callers should expose only `error.code`, never the
 * approval reference or internal database error.
 */
export async function requireApprovedComplianceGate(
  gateKey: ComplianceGateKey,
  client?: Pick<PoolClient, 'query'>,
): Promise<void> {
  let row: ComplianceGateRow | null

  try {
    if (client) {
      const result = await client.query<ComplianceGateRow>(
        `SELECT gate_key, status, approval_reference, approved_by, approved_at
           FROM trust_compliance_gates
          WHERE gate_key = $1
          FOR SHARE`,
        [gateKey],
      )
      row = result.rows[0] ?? null
    } else {
      row = await queryOne<ComplianceGateRow>(
        `SELECT gate_key, status, approval_reference, approved_by, approved_at
           FROM trust_compliance_gates
          WHERE gate_key = $1`,
        [gateKey],
      )
    }
  } catch {
    throw new ComplianceGateError(gateKey, 'COMPLIANCE_GATE_UNAVAILABLE')
  }

  if (!row || row.gate_key !== gateKey) {
    throw new ComplianceGateError(gateKey, 'COMPLIANCE_GATE_UNAVAILABLE')
  }

  if (row.status === 'pending' || row.status === 'blocked') {
    throw new ComplianceGateError(gateKey, 'COMPLIANCE_GATE_NOT_APPROVED')
  }

  if (!hasCompleteApproval(row)) {
    throw new ComplianceGateError(gateKey, 'COMPLIANCE_GATE_UNAVAILABLE')
  }
}
