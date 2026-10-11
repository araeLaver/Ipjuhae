import Link from 'next/link'
import { candidateQuestionHref, remainingCandidateTasks } from '@/lib/check-next-actions'
export function CandidateNextSteps({ checked, onAsk }: { checked: readonly boolean[]; onAsk: () => void }) {
  const remaining = remainingCandidateTasks(checked)
  return <section className="space-y-2 rounded-lg bg-muted/40 p-3" aria-label="이 후보의 남은 확인 사항">
    <h4 className="text-sm font-bold">남은 확인 {remaining.length}개</h4>
    {remaining.length ? <>
      <p className="text-sm">다음 할 일: {remaining[0].action.title}</p>
      <ul className="space-y-2">{remaining.map(task => <li key={task.id}>
        <details className="rounded border bg-background p-3" open={task.id === remaining[0].id}>
          <summary className="cursor-pointer text-sm font-semibold">{task.action.title}</summary>
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>확인할 자료:</strong> {task.action.documents}</p>
            <p><strong>물어볼 상대:</strong> {task.action.contact}</p>
            <p>{task.action.question}</p>
            <Link href={candidateQuestionHref(task.id)} onClick={onAsk} className="inline-block text-primary underline">이 확인 항목 질문하기</Link>
          </div>
        </details>
      </li>)}</ul>
    </> : <p className="text-sm">4개 항목을 확인했다고 기록했습니다. 저장 이후 조건이나 등기부가 바뀌었다면 해당 항목의 체크를 풀고 다시 확인하세요.</p>}
    <p className="text-xs text-muted-foreground">본인이 남긴 확인 기록입니다. 확인 완료가 계약 안전을 보장하지 않습니다. 질문에는 후보 별칭과 입력 금액을 자동으로 넣지 않습니다.</p>
  </section>
}
