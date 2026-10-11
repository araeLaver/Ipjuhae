import type { DepositRiskInput } from '@/lib/deposit-risk'

export const CANDIDATES_KEY = 'ipjuhae.check-candidates.v1'
export const MAX_CANDIDATES = 5
export const CHECKLIST = [
  '최신 등기부를 직접 확인했어요',
  '계약 상대와 등기부 소유자를 확인했어요',
  '근저당과 선순위 보증금을 확인했어요',
  '보증보험 가입 요건을 해당 기관에서 확인했어요',
] as const
export interface CheckCandidate {
  id: string
  label: string
  savedAt: string
  input: DepositRiskInput
  checked: boolean[]
}
const fields = ['marketPriceManwon', 'depositManwon', 'mortgageMaxManwon', 'priorDepositsManwon'] as const

/** Reject damaged or unknown data instead of silently overwriting saved homes. */
export function decodeCandidates(raw: string | null): CheckCandidate[] {
  if (raw === null) return []
  const data = JSON.parse(raw)
  if (data?.version !== 1 || !Array.isArray(data.items) || data.items.length > MAX_CANDIDATES) throw Error('INVALID_CANDIDATES')
  const seen = new Set<string>()
  return data.items.map((item: CheckCandidate) => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 64 || seen.has(item.id)
      || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40
      || typeof item.savedAt !== 'string' || !Number.isFinite(Date.parse(item.savedAt))
      || !item.input || !fields.every(key => Number.isSafeInteger(item.input[key]) && item.input[key] >= 0 && item.input[key] <= 999999999)
      || item.input.marketPriceManwon === 0
      || !Array.isArray(item.checked) || item.checked.length !== CHECKLIST.length || !item.checked.every(value => typeof value === 'boolean')) throw Error('INVALID_CANDIDATES')
    seen.add(item.id)
    return { id: item.id, label: item.label.trim(), savedAt: item.savedAt,
      input: { marketPriceManwon: item.input.marketPriceManwon, depositManwon: item.input.depositManwon,
        mortgageMaxManwon: item.input.mortgageMaxManwon, priorDepositsManwon: item.input.priorDepositsManwon }, checked: [...item.checked] }
  })
}
export function encodeCandidates(items: CheckCandidate[]): string {
  const raw = JSON.stringify({ version: 1, items })
  decodeCandidates(raw)
  return raw
}
