import { CHECKLIST, type CheckCandidate } from '@/lib/check-candidates'
import { calculateDepositRisk, manwon } from '@/lib/deposit-risk'

export function candidateSummary(items: CheckCandidate[]) {
  return [
    '입주해 · 내 계약 준비 기록',
    '직접 입력한 숫자와 본인이 남긴 확인 기록입니다. 계약의 안전이나 보증 가입을 보장하지 않습니다.',
    ...items.flatMap((item) => [
      '',
      item.label,
      `기록일: ${new Date(item.savedAt).toISOString().slice(0, 10)}`,
      `매매 시세: ${manwon(item.input.marketPriceManwon)}`,
      `보증금: ${manwon(item.input.depositManwon)}`,
      `근저당 채권최고액: ${manwon(item.input.mortgageMaxManwon)}`,
      `선순위 보증금: ${manwon(item.input.priorDepositsManwon)}`,
      `입력 기준 결과: ${calculateDepositRisk(item.input).headline}`,
      ...CHECKLIST.map(
        (text, index) =>
          `${item.checked[index] ? '[본인 확인]' : '[남은 확인]'} ${text}`,
      ),
    ]),
    '',
    '숫자와 등기부가 변경됐다면 다시 확인하세요.',
    '다시 점검: https://www.ipjuhae.com/check',
  ].join('\n')
}
