/**
 * 등기부등본(갑구·을구) 텍스트에서 근저당 채권최고액과 핵심 위험 신호를 추출한다.
 *
 * 인터넷등기소 PDF/웹 화면에서 복사한 텍스트는 브라우저 로컬에서만 파싱하며
 * 서버로 전송하지 않는다. 금액·권리 판단의 최종 확인은 반드시 등기부 원본을 따른다.
 */

export type RegistryFlagCode =
  | 'trust'
  | 'seizure'
  | 'provisional_seizure'
  | 'auction'
  | 'lease_registration'
  | 'provisional_registration'

export interface RegistryFlag {
  code: RegistryFlagCode
  label: string
  severity: 'critical' | 'warning'
  summary: string
}

export interface RegistryParseResult {
  /** 추출된 근저당 채권최고액 합계 (만원). 말소된 항목은 가능하면 제외 */
  mortgageMaxManwon: number
  /** 감지된 개별 채권최고액 목록 (만원) */
  mortgageEntriesManwon: number[]
  /** 갑구·을구에서 탐지된 위험 신호 */
  flags: RegistryFlag[]
  /** 사용자 안내 메모 */
  notes: string[]
}

const FLAG_RULES: Array<{
  code: RegistryFlagCode
  label: string
  severity: 'critical' | 'warning'
  pattern: RegExp
  summary: string
}> = [
  {
    code: 'auction',
    label: '경매개시결정',
    severity: 'critical',
    pattern: /경매개시결정|임의경매|강제경매/,
    summary: '이미 경매 절차가 개시된 기록이 있습니다. 말소 여부를 반드시 확인하고 계약을 보류하세요.',
  },
  {
    code: 'trust',
    label: '신탁 등기',
    severity: 'critical',
    pattern: /신탁\s*등기|신탁원부|수탁자|신탁재산|소유권이전.*신탁/,
    summary: '신탁 부동산은 집주인이 아니라 신탁회사의 서면 동의가 없으면 보증금을 보호받기 어렵습니다.',
  },
  {
    code: 'seizure',
    label: '압류',
    severity: 'critical',
    pattern: /(?<!가)압류(?!\s*말소)/,
    summary: '국세·지방세 체납 등으로 압류가 걸린 기록이 보입니다. 완납 및 말소 확인 전 계약은 매우 위험합니다.',
  },
  {
    code: 'provisional_seizure',
    label: '가압류',
    severity: 'critical',
    pattern: /가압류(?!\s*말소)/,
    summary: '채권자의 가압류 기록이 있습니다. 잔금 전 말소 조건을 걸지 않으면 경매 시 보증금이 밀릴 수 있습니다.',
  },
  {
    code: 'lease_registration',
    label: '임차권등기명령',
    severity: 'critical',
    pattern: /임차권등기명령|주택임차권/,
    summary: '이전 세입자가 보증금을 제때 돌려받지 못해 임차권등기를 설정한 이력이 있습니다.',
  },
  {
    code: 'provisional_registration',
    label: '가등기 / 예고등기',
    severity: 'warning',
    pattern: /소유권이전청구권가등기|담보가등기|예고등기/,
    summary: '소유권이 넘어갈 수 있는 가등기 기록이 있습니다. 본등기 시 임차권이 소멸될 수 있으니 꼭 확인하세요.',
  },
]

/**
 * 한국어 금액 표기("금 120,000,000원", "금1억2,000만원", "2억 4000만원", "150,000,000원")를 만원 단위로 변환한다.
 */
export function parseKoreanAmountToManwon(raw: string): number | null {
  const cleaned = raw.replace(/\s+/g, '').replace(/금/g, '').replace(/,/g, '')
  if (!cleaned) return null

  // 1) "1억2000만원", "2억원", "1억5000만" 형태
  const eokMatch = cleaned.match(/^(\d+(?:\.\d+)?)억(?:(\d+(?:\.\d+)?)만)?원?$/)
  if (eokMatch) {
    const eok = Number(eokMatch[1])
    const man = eokMatch[2] ? Number(eokMatch[2]) : 0
    if (!Number.isFinite(eok) || !Number.isFinite(man)) return null
    const total = Math.round(eok * 10000 + man)
    return total > 0 ? total : null
  }

  // 2) "12000만원" 형태
  const manMatch = cleaned.match(/^(\d+(?:\.\d+)?)만원?$/)
  if (manMatch) {
    const man = Number(manMatch[1])
    if (!Number.isFinite(man)) return null
    const total = Math.round(man)
    return total > 0 ? total : null
  }

  // 3) "120000000원" 또는 숫자만 (100만원 이상 원 단위 표기)
  const wonMatch = cleaned.match(/^(\d{7,13})원?$/)
  if (wonMatch) {
    const won = Number(wonMatch[1])
    if (!Number.isFinite(won)) return null
    const total = Math.round(won / 10000)
    return total > 0 ? total : null
  }

  return null
}

/**
 * 등기부등본에서 복사한 텍스트를 분석해 근저당 채권최고액 합계(만원)와 위험 신호를 추출한다.
 */
export function parseRegistryText(text: string): RegistryParseResult {
  const normalized = text.trim()
  if (!normalized) {
    return { mortgageMaxManwon: 0, mortgageEntriesManwon: [], flags: [], notes: [] }
  }

  const lines = normalized.split(/\r?\n/)
  const mortgageEntriesManwon: number[] = []
  const notes: string[] = []
  let skippedCancelled = 0

  // 채권최고액 표기를 줄 단위 및 인접 문맥에서 추출한다.
  const amountRegex =
    /채권최고액\s*[:：]?\s*(금?\s*(?:\d[\d,.]*\s*억(?:\s*\d[\d,.]*\s*만)?\s*원?|\d[\d,.]*\s*만\s*원?|\d[\d,]{6,}\s*원))/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const context = `${line} ${lines[i + 1] ?? ''}`

    // 말소 표시가 같은 줄에 명확히 있는 경우는 제외하고 사용자에게 안내한다.
    if (/채권최고액/.test(line) && /말소|해지/.test(line)) {
      skippedCancelled++
      continue
    }

    let match: RegExpExecArray | null
    amountRegex.lastIndex = 0
    while ((match = amountRegex.exec(context)) !== null) {
      // 다음 줄에서만 매치된 경우 중복 카운트 방지
      if (match.index >= line.length) break
      const manwonVal = parseKoreanAmountToManwon(match[1])
      if (manwonVal !== null) {
        mortgageEntriesManwon.push(manwonVal)
      }
    }
  }

  // 말소되지 않은 위험 신호 탐지 (줄 단위로 '말소' 언급된 줄은 제외 시도)
  const activeText = lines
    .filter((line) => !/(\d+번.*말소|근저당권말소|압류말소|가압류말소|신탁말소|임차권등기말소)/.test(line))
    .join('\n')

  const flags: RegistryFlag[] = []
  for (const rule of FLAG_RULES) {
    if (rule.pattern.test(activeText)) {
      flags.push({
        code: rule.code,
        label: rule.label,
        severity: rule.severity,
        summary: rule.summary,
      })
    }
  }

  const mortgageMaxManwon = mortgageEntriesManwon.reduce((sum, v) => sum + v, 0)

  if (skippedCancelled > 0) {
    notes.push(`말소·해지 표기가 있는 근저당 ${skippedCancelled}건은 합계에서 제외했습니다. 원본 말소선을 꼭 확인하세요.`)
  }
  if (mortgageEntriesManwon.length > 0) {
    notes.push(`을구 채권최고액 ${mortgageEntriesManwon.length}건이 감지되어 합계에 반영되었습니다.`)
  } else {
    notes.push('텍스트에서 채권최고액 금액을 찾지 못했습니다. 근저당이 있다면 을구 금액을 직접 입력해 주세요.')
  }

  return {
    mortgageMaxManwon,
    mortgageEntriesManwon,
    flags,
    notes,
  }
}

/**
 * OpenAI Vision 응답 JSON을 안전하게 정규화한다.
 */
export function normalizeAiRegistryPayload(raw: unknown): RegistryParseResult {
  if (!raw || typeof raw !== 'object') {
    return { mortgageMaxManwon: 0, mortgageEntriesManwon: [], flags: [], notes: ['인식 결과를 해석하지 못했습니다.'] }
  }
  const obj = raw as Record<string, unknown>
  const entries = Array.isArray(obj.mortgageEntriesManwon)
    ? obj.mortgageEntriesManwon
        .map((n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null))
        .filter((n): n is number => n !== null && n <= 1_000_000)
    : []

  const directSum =
    typeof obj.mortgageMaxManwon === 'number' && Number.isFinite(obj.mortgageMaxManwon) && obj.mortgageMaxManwon >= 0
      ? Math.round(obj.mortgageMaxManwon)
      : entries.reduce((s, n) => s + n, 0)

  const mortgageMaxManwon = entries.length > 0 ? entries.reduce((s, n) => s + n, 0) : Math.min(directSum, 1_000_000)

  const rawCodes = Array.isArray(obj.flagCodes) ? obj.flagCodes.filter((c): c is string => typeof c === 'string') : []
  const flags: RegistryFlag[] = []
  for (const rule of FLAG_RULES) {
    if (rawCodes.includes(rule.code)) {
      flags.push({
        code: rule.code,
        label: rule.label,
        severity: rule.severity,
        summary: rule.summary,
      })
    }
  }

  const notes = [
    mortgageMaxManwon > 0
      ? `이미지에서 근저당 채권최고액 합계 ${mortgageMaxManwon.toLocaleString('ko-KR')}만원을 추출했습니다. 원본 등기부 숫자와 꼭 대조하세요.`
      : '이미지에서 유효한 근저당 채권최고액이 확인되지 않았습니다. 을구 원본을 다시 확인해 주세요.',
  ]

  return { mortgageMaxManwon, mortgageEntriesManwon: entries, flags, notes }
}
