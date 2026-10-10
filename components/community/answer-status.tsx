export function AnswerStatus({ answered }: { answered: boolean | undefined }) {
  if (typeof answered !== 'boolean') return null
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{answered ? '운영자 답변 있음' : '운영자 답변 대기'}</span>
}
