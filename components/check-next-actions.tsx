import { checkNextActions, HUG_DOCUMENTS_URL } from '@/lib/check-next-actions'
import type { RiskLevel } from '@/lib/deposit-risk'
export function CheckNextActions({ level }: { level: RiskLevel }) {
  return <section className="space-y-3" aria-label="계약 전 확인할 자료와 질문">
    <h3 className="text-sm font-bold">지금 확인할 자료와 질문</h3>
    <p className="text-xs text-muted-foreground">계산의 여유가 서류 확인 완료를 뜻하지 않습니다. 근저당·선순위 보증금 빈칸은 0원으로 계산했으므로, 금액을 모른다면 자료부터 확인하세요.</p>
    <ol className="space-y-3">{checkNextActions(level).map(action => <li key={action.title} className="space-y-2 rounded-lg border p-3 text-sm">
      <h4 className="font-semibold">{action.title}</h4>
      <p><strong>확인할 자료:</strong> {action.documents}</p>
      <p><strong>물어볼 상대:</strong> {action.contact}</p>
      <p className="rounded bg-muted p-2">{action.question}</p>
    </li>)}</ol>
    <a href={HUG_DOCUMENTS_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">HUG 공식 제출서류 안내 확인</a>
    <p className="text-xs text-muted-foreground">필요한 서류와 가입 여부는 주택·계약·보증기관의 심사에 따라 달라집니다.</p>
  </section>
}
