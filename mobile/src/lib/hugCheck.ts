/**
 * HUG 전세보증금반환보증(126% 룰 / 시세 90%) 사전 판정 계산기 (모바일).
 */

export type ValuationBasis = 'official_price' | 'market_price';
export type RegionType = 'metro' | 'non_metro';
export type HugVerdict = 'likely' | 'caution' | 'ineligible';

export interface HugCheckInput {
  basis: ValuationBasis;
  basePriceManwon: number;
  depositManwon: number;
  seniorDebtManwon: number;
  region: RegionType;
}

export interface HugCheckResult {
  verdict: HugVerdict;
  recognizedHousePriceManwon: number;
  maxTotalLimitManwon: number;
  maxEligibleDepositManwon: number;
  regionCapManwon: number;
  ltvRatio: number;
  seniorRatio: number;
  officialPriceMultiple: number | null;
  headline: string;
  reasons: string[];
  recommendations: string[];
}

export const HUG_OFFICIAL_PRICE_MULTIPLIER = 1.4;
export const HUG_LTV_LIMIT = 0.9;
export const HUG_SENIOR_LIMIT = 0.6;
export const HUG_METRO_CAP_MANWON = 70000;
export const HUG_NON_METRO_CAP_MANWON = 50000;

export function calculateHugEligibility(input: HugCheckInput): HugCheckResult {
  const basePrice = Math.max(0, Math.round(input.basePriceManwon));
  const deposit = Math.max(0, Math.round(input.depositManwon));
  const senior = Math.max(0, Math.round(input.seniorDebtManwon));

  const recognizedHousePriceManwon =
    input.basis === 'official_price'
      ? Math.floor(basePrice * HUG_OFFICIAL_PRICE_MULTIPLIER)
      : basePrice;

  const maxTotalLimitManwon = Math.floor(recognizedHousePriceManwon * HUG_LTV_LIMIT);
  const regionCapManwon =
    input.region === 'metro' ? HUG_METRO_CAP_MANWON : HUG_NON_METRO_CAP_MANWON;

  const maxEligibleDepositManwon = Math.max(
    0,
    Math.min(maxTotalLimitManwon - senior, regionCapManwon)
  );

  const totalDebt = senior + deposit;
  const ltvRatio = recognizedHousePriceManwon > 0 ? totalDebt / recognizedHousePriceManwon : Infinity;
  const seniorRatio = recognizedHousePriceManwon > 0 ? senior / recognizedHousePriceManwon : Infinity;
  const officialPriceMultiple =
    input.basis === 'official_price' && basePrice > 0 ? totalDebt / basePrice : null;

  const reasons: string[] = [];
  const recommendations: string[] = [];

  const exceedsLtv = totalDebt > maxTotalLimitManwon;
  const exceedsSenior = seniorRatio > HUG_SENIOR_LIMIT;
  const exceedsRegionCap = deposit > regionCapManwon;

  if (exceedsLtv) {
    const over = totalDebt - maxTotalLimitManwon;
    reasons.push(
      input.basis === 'official_price'
        ? `선순위+보증금이 공시가격의 126% 한도(${maxTotalLimitManwon.toLocaleString('ko-KR')}만원)를 ${over.toLocaleString('ko-KR')}만원 초과합니다.`
        : `선순위+보증금이 주택가격의 90% 한도(${maxTotalLimitManwon.toLocaleString('ko-KR')}만원)를 ${over.toLocaleString('ko-KR')}만원 초과합니다.`
    );
    recommendations.push(
      `보증금을 ${maxEligibleDepositManwon.toLocaleString('ko-KR')}만원 이하로 낮추거나, 잔금 시 선순위 근저당 말소 특약을 넣어야 합니다.`
    );
  }

  if (exceedsSenior) {
    reasons.push(
      `선순위 채권 비율이 ${Math.round(seniorRatio * 100)}%로 통상 기준(주택가격의 60% 이하)을 넘습니다.`
    );
    recommendations.push('선순위 근저당을 잔금 당일 전액 말소 또는 감액하는 특약이 필수입니다.');
  }

  if (exceedsRegionCap) {
    reasons.push(
      `보증금이 ${input.region === 'metro' ? '수도권 7억원' : '비수도권 5억원'} HUG 보증 한도를 초과합니다.`
    );
    recommendations.push('HUG 외에 SGI서울보증 또는 HF(한국주택금융공사) 가입 가능 여부를 확인하세요.');
  }

  let verdict: HugVerdict;
  let headline: string;

  if (exceedsLtv || exceedsSenior || exceedsRegionCap) {
    verdict = 'ineligible';
    headline = '현재 조건은 HUG 보증보험 한도를 초과합니다';
  } else if (ltvRatio > 0.8 || senior > 0) {
    verdict = 'caution';
    headline = '한도 안쪽이지만 선순위·주택요건을 꼭 확인해야 합니다';
    reasons.push(
      senior > 0
        ? `선순위 채권(${senior.toLocaleString('ko-KR')}만원)이 있어 등기부 원본 및 잔금일 말소 여부를 확인해야 합니다.`
        : `주택가격 대비 보증금 비율이 ${Math.round(ltvRatio * 100)}%로 여유 폭이 좁습니다.`
    );
    recommendations.push(
      '계약서에 "전세보증보험 가입 불가 시 계약 무효 및 계약금 전액 반환" 특약을 반드시 넣으세요.'
    );
  } else {
    verdict = 'likely';
    headline = '금액 기준으로는 HUG 보증보험 한도 안쪽입니다';
    reasons.push(
      `인정 주택가격 대비 부담률 ${Math.round(ltvRatio * 100)}%로 90% 한도 이내이며, 선순위 채권도 없습니다.`
    );
    recommendations.push(
      '금액 외 요건(위반건축물 여부, 임대인 체납, 신탁·압류 여부)을 계약 직전에 꼭 확인하세요.'
    );
  }

  recommendations.push('잔금 당일 전입신고와 확정일자를 완료해야 보증보험 가입 및 대항력이 유지됩니다.');

  return {
    verdict,
    recognizedHousePriceManwon,
    maxTotalLimitManwon,
    maxEligibleDepositManwon,
    regionCapManwon,
    ltvRatio,
    seniorRatio,
    officialPriceMultiple,
    headline,
    reasons,
    recommendations,
  };
}
