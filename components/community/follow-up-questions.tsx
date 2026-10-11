'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AnswerStatus } from '@/components/community/answer-status'
import { QUESTION_KEY, QUESTION_CHANGED, readQuestions } from '@/lib/community-follow-up'
interface FollowedQuestion { id: string; title: string; has_operator_reply: boolean }
export function FollowUpQuestions() {
  const [items, setItems] = useState<FollowedQuestion[]>([])
  const [missing, setMissing] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const revision = useRef(0)
  const load = useCallback(async () => {
    const run = ++revision.current
    setLoading(true)
    try {
      const ids = readQuestions(localStorage.getItem(QUESTION_KEY))
      if (!ids.length) { setItems([]); setMissing(0); setError(''); return }
      const res = await fetch(`/api/community/posts?ids=${ids.join(',')}&limit=50`, { cache: 'no-store' })
      if (!res.ok) throw Error('UNAVAILABLE')
      const data = await res.json()
      if (!Array.isArray(data.posts)) throw Error('INVALID_RESPONSE')
      if (run !== revision.current) return
      const rows: FollowedQuestion[] = data.posts.filter((p: FollowedQuestion) => ids.includes(p.id))
      const ordered = ids.flatMap(id => rows.filter(row => row.id === id))
      setItems(ordered); setMissing(ids.length - ordered.length); setError('')
    } catch { if (run === revision.current) setError('보관한 질문을 불러오지 못했습니다. 저장 권한과 연결을 확인한 뒤 다시 시도하세요.') }
    finally { if (run === revision.current) setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const refresh = () => { void load() }
    const storage = (event: StorageEvent) => { if (event.key === QUESTION_KEY || event.key === null) refresh() }
    window.addEventListener(QUESTION_CHANGED, refresh); window.addEventListener('storage', storage)
    return () => { revision.current++; window.removeEventListener(QUESTION_CHANGED, refresh); window.removeEventListener('storage', storage) }
  }, [load])
  return <Card id="follow-up" className="mb-8 space-y-3 p-5">
    <h2 className="text-lg font-bold">이 기기에 보관한 질문</h2>
    <p className="text-sm text-muted-foreground">이 브라우저에서 등록한 최근 질문 20개의 링크를 보관합니다. 다른 기기와 동기화되지 않으며 브라우저 데이터를 지우면 목록이 사라집니다. 답변 확인은 새로고침 버튼을 눌러주세요.</p>
    <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>{loading ? '확인 중…' : '답변 상태 새로고침'}</Button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : !loading && items.length === 0 && missing === 0 ? <p className="text-sm text-muted-foreground">보관한 질문이 없습니다. 질문을 등록하면 링크가 여기에 남습니다.</p> : <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><Link className="font-semibold text-primary underline" href={`/community/${item.id}`}>{item.title}</Link><AnswerStatus answered={item.has_operator_reply} /></li>)}</ul>}
    {!error && missing > 0 && <p className="text-sm text-muted-foreground">{missing}개 질문은 삭제·숨김 상태이거나 현재 계정으로 볼 수 없습니다. 역할 게시판 질문은 해당 계정으로 로그인한 뒤 다시 확인하세요.</p>}
    <Button type="button" variant="outline" onClick={() => setConfirmClear(true)}>이 기기 목록 비우기</Button>
    {confirmClear && <div className="space-y-2"><p className="text-sm">질문과 댓글은 삭제하지 않고 이 기기의 링크 목록만 지울까요?</p><Button type="button" onClick={() => { try { localStorage.removeItem(QUESTION_KEY); setConfirmClear(false); void load() } catch { setError('기기 목록을 지우지 못했습니다. 저장 권한을 확인하세요.') } }}>링크 목록 지우기</Button><Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>취소</Button></div>}
  </Card>
}
