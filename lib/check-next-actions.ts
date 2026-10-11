import type { RiskLevel } from '@/lib/deposit-risk'

export const HUG_DOCUMENTS_URL = 'https://m.khug.or.kr/hug/web/ig/dr/igdr000002.jsp?tabMenu=Y'
export interface CheckAction { title: string; documents: string; contact: string; question: string }
const registration: CheckAction = {
  title: '등기부와 계약 상대 확인', documents: '최신 등기사항전부증명서의 갑구·을구와 계약서 초안',
  contact: '공인중개사·임대인', question: '등기부 소유자와 계약 상대가 일치하나요? 권리 제한이나 근저당이 있나요?',
}
const senior: CheckAction = {
  title: '선순위 금액의 근거 확인', documents: '등기부 을구와 다가구의 타 전세계약체결내역 확인 자료',
  contact: '공인중개사·임대인', question: '근저당 채권최고액과 앞선 세입자의 보증금을 어떤 자료로 확인할 수 있나요?',
}
const guarantee: CheckAction = {
  title: '보증 가입 가능 여부 문의', documents: '등기사항전부증명서·계약서 초안·주택 유형과 시세 근거',
  contact: 'HUG 등 보증기관·보증 취급 금융기관', question: '이 주택과 계약 조건으로 보증 신청이 가능한가요? 추가로 필요한 자료는 무엇인가요?',
}
const conditions: CheckAction = {
  title: '계약 조건을 확인하고 후보 비교', documents: '계약서 초안·근저당 정리 계획·다른 후보의 점검 결과',
  contact: '공인중개사·임대인', question: '근저당 정리 여부와 확인 시점을 계약서에 어떻게 적고 실제 이행을 확인할 수 있나요?',
}
export function checkNextActions(level: RiskLevel): CheckAction[] {
  return level === 'safe' ? [registration, senior, guarantee] : [senior, guarantee, conditions, registration]
}
const labels: Record<RiskLevel, string> = { safe: '여유 있음', caution: '주의', danger: '위험', critical: '매우 위험' }
export function checkQuestionHref(level: RiskLevel): string { return `/community#ask=check-${level}` }
// Order matches the existing four checklist entries; saved records need no migration.
export const CANDIDATE_TASKS = [
  { id: 'register', action: { ...registration, title: '최신 등기부 확인', question: '최신 등기부의 갑구·을구에서 어떤 권리 제한과 근저당을 확인해야 하나요?' } },
  { id: 'owner', action: { title: '계약 상대와 소유자 확인', documents: '등기부 갑구·계약서 초안과 계약 상대 확인 자료', contact: '공인중개사·임대인', question: '계약 상대와 등기부 소유자가 같은지 어떻게 확인하나요? 대리 계약이면 어떤 자료를 확인해야 하나요?' } },
  { id: 'senior', action: senior },
  { id: 'guarantee', action: guarantee },
] as const
export function remainingCandidateTasks(checked: readonly boolean[]) {
  return CANDIDATE_TASKS.filter((_, index) => checked[index] !== true)
}
export function candidateQuestionHref(id: typeof CANDIDATE_TASKS[number]['id']) { return `/community#ask=task-${id}` }
export function checkQuestionDraft(hash: string): { title: string; body: string } | null {
  const task = CANDIDATE_TASKS.find(item => hash === `#ask=task-${item.id}`)
  if (task) return {
    title: `${task.action.title} 방법을 질문합니다`,
    body: `저장한 후보의 계약 전 확인 항목 중 '${task.action.title}'을 아직 확인하지 못했습니다.\n\n${task.action.question}\n\n확인할 자료: ${task.action.documents}\n제가 확인한 내용: [직접 적어주세요]\n막힌 부분: [직접 적어주세요]\n\n주소·건물명·연락처·계약서 원본 등 개인정보는 적지 않겠습니다.`,
  }
  const level = hash.replace(/^#ask=check-/, '')
  if (!hash.startsWith('#ask=check-') || !Object.prototype.hasOwnProperty.call(labels, level)) return null
  const grade = level as RiskLevel
  return {
    title: '보증금 점검 후 계약 전 확인할 내용을 질문합니다',
    body: `입주해 보증금 점검에서 '${labels[grade]}' 결과를 봤습니다. 입력값에 따른 참고 결과라는 점은 알고 있습니다.\n\n계약 전 무엇을 확인해야 할지 질문합니다.\n${checkNextActions(grade).map(action => `- ${action.question}`).join('\n')}\n\n제가 확인한 내용: [직접 적어주세요]\n아직 확인하지 못한 내용: [직접 적어주세요]\n\n주소·건물명·연락처·계약서 원본 등 개인정보는 적지 않겠습니다.`,
  }
}
