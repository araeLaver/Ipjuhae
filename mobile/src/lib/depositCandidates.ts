/**
 * 모바일 보증금 점검 후보 집 비교 저장소 (순수 로직).
 * 최대 5곳의 후보 집을 기기 로컬에만 보관하며 서버로 전송하지 않는다.
 */

import { RiskLevel } from './depositRisk';

export const MAX_SAVED_CANDIDATES = 5;

export interface SavedDepositCandidate {
  id: string;
  label: string;
  marketPriceManwon: number;
  depositManwon: number;
  mortgageMaxManwon: number;
  priorDepositsManwon: number;
  level: RiskLevel;
  burdenRatio: number;
  auctionCushionManwon: number;
  savedAt: string;
}

export function parseSavedCandidates(raw: string | null): SavedDepositCandidate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedDepositCandidate =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.label === 'string' &&
          typeof item.marketPriceManwon === 'number' &&
          typeof item.depositManwon === 'number'
      )
      .slice(0, MAX_SAVED_CANDIDATES);
  } catch {
    return [];
  }
}

export function addDepositCandidate(
  existing: SavedDepositCandidate[],
  candidate: Omit<SavedDepositCandidate, 'id' | 'savedAt'> & { id?: string; savedAt?: string }
): SavedDepositCandidate[] {
  const cleanLabel = candidate.label.trim() || `후보 집 ${existing.length + 1}`;
  const entry: SavedDepositCandidate = {
    ...candidate,
    id: candidate.id ?? `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: cleanLabel.slice(0, 40),
    savedAt: candidate.savedAt ?? new Date().toISOString(),
  };

  // 동일한 숫자 조건의 후보가 이미 있으면 최신 항목으로 교체해 중복을 막는다.
  const deduped = existing.filter(
    (item) =>
      !(
        item.marketPriceManwon === entry.marketPriceManwon &&
        item.depositManwon === entry.depositManwon &&
        item.mortgageMaxManwon === entry.mortgageMaxManwon &&
        item.priorDepositsManwon === entry.priorDepositsManwon
      )
  );

  return [entry, ...deduped].slice(0, MAX_SAVED_CANDIDATES);
}

export function removeDepositCandidate(
  existing: SavedDepositCandidate[],
  id: string
): SavedDepositCandidate[] {
  return existing.filter((item) => item.id !== id);
}

const LEVEL_RANK: Record<RiskLevel, number> = {
  safe: 0,
  caution: 1,
  danger: 2,
  critical: 3,
};

/**
 * 저장된 후보 집 중 가장 안전한 집(위험 등급 낮음 → 경매 여유금 높음)을 반환한다.
 */
export function pickSafestCandidate(
  candidates: SavedDepositCandidate[]
): SavedDepositCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      b.auctionCushionManwon - a.auctionCushionManwon
  )[0];
}
