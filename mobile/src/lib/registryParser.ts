/**
 * 등기부등본(갑구·을구) 텍스트에서 근저당 채권최고액과 핵심 위험 신호를 추출한다.
 *
 * 기기 로컬에서만 파싱하며 서버로 전송하지 않는다.
 * 금액·권리 판단의 최종 확인은 반드시 등기부 원본을 따른다.
 */

export type RegistryFlagCode =
  | 'trust'
  | 'seizure'
  | 'provisional_seizure'
  | 'auction'
  | 'lease_registration'
  | 'provisional_registration';

export interface RegistryFlag {
  code: RegistryFlagCode;
  label: string;
  severity: 'critical' | 'warning';
  summary: string;
}

export interface RegistryParseResult {
  mortgageMaxManwon: number;
  mortgageEntriesManwon: number[];
  flags: RegistryFlag[];
  notes: string[];
}

const FLAG_RULES: Array<{
  code: RegistryFlagCode;
  label: string;
  severity: 'critical' | 'warning';
  pattern: RegExp;
  summary: string;
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
    pattern: /(^|[^가])압류(?!\s*말소)/,
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
];

export function parseKoreanAmountToManwon(raw: string): number | null {
  const cleaned = raw.replace(/\s+/g, '').replace(/금/g, '').replace(/,/g, '');
  if (!cleaned) return null;

  const eokMatch = cleaned.match(/^(\d+(?:\.\d+)?)억(?:(\d+(?:\.\d+)?)만)?원?$/);
  if (eokMatch) {
    const eok = Number(eokMatch[1]);
    const man = eokMatch[2] ? Number(eokMatch[2]) : 0;
    if (!Number.isFinite(eok) || !Number.isFinite(man)) return null;
    const total = Math.round(eok * 10000 + man);
    return total > 0 ? total : null;
  }

  const manMatch = cleaned.match(/^(\d+(?:\.\d+)?)만원?$/);
  if (manMatch) {
    const man = Number(manMatch[1]);
    if (!Number.isFinite(man)) return null;
    const total = Math.round(man);
    return total > 0 ? total : null;
  }

  const wonMatch = cleaned.match(/^(\d{7,13})원?$/);
  if (wonMatch) {
    const won = Number(wonMatch[1]);
    if (!Number.isFinite(won)) return null;
    const total = Math.round(won / 10000);
    return total > 0 ? total : null;
  }

  return null;
}

export function parseRegistryText(text: string): RegistryParseResult {
  const normalized = text.trim();
  if (!normalized) {
    return { mortgageMaxManwon: 0, mortgageEntriesManwon: [], flags: [], notes: [] };
  }

  const lines = normalized.split(/\r?\n/);
  const mortgageEntriesManwon: number[] = [];
  const notes: string[] = [];
  let skippedCancelled = 0;

  const amountRegex =
    /채권최고액\s*[:：]?\s*(금?\s*(?:\d[\d,.]*\s*억(?:\s*\d[\d,.]*\s*만)?\s*원?|\d[\d,.]*\s*만\s*원?|\d[\d,]{6,}\s*원))/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = `${line} ${lines[i + 1] ?? ''}`;

    if (/채권최고액/.test(line) && /말소|해지/.test(line)) {
      skippedCancelled++;
      continue;
    }

    let match: RegExpExecArray | null;
    amountRegex.lastIndex = 0;
    while ((match = amountRegex.exec(context)) !== null) {
      if (match.index >= line.length) break;
      const manwonVal = parseKoreanAmountToManwon(match[1]);
      if (manwonVal !== null) {
        mortgageEntriesManwon.push(manwonVal);
      }
    }
  }

  const activeText = lines
    .filter((line) => !/(\d+번.*말소|근저당권말소|압류말소|가압류말소|신탁말소|임차권등기말소)/.test(line))
    .join('\n');

  const flags: RegistryFlag[] = [];
  for (const rule of FLAG_RULES) {
    if (rule.pattern.test(activeText)) {
      flags.push({
        code: rule.code,
        label: rule.label,
        severity: rule.severity,
        summary: rule.summary,
      });
    }
  }

  const mortgageMaxManwon = mortgageEntriesManwon.reduce((sum, v) => sum + v, 0);

  if (skippedCancelled > 0) {
    notes.push(`말소·해지 표기가 있는 근저당 ${skippedCancelled}건은 합계에서 제외했습니다. 원본 말소선을 꼭 확인하세요.`);
  }
  if (mortgageEntriesManwon.length > 0) {
    notes.push(`을구 채권최고액 ${mortgageEntriesManwon.length}건이 감지되어 합계에 반영되었습니다.`);
  } else {
    notes.push('텍스트에서 채권최고액 금액을 찾지 못했습니다. 근저당이 있다면 을구 금액을 직접 입력해 주세요.');
  }

  return {
    mortgageMaxManwon,
    mortgageEntriesManwon,
    flags,
    notes,
  };
}
