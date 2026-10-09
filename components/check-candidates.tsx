'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAttribution } from '@/lib/attribution'
import { track } from '@/lib/analytics-client'
import { CANDIDATES_KEY, CHECKLIST, MAX_CANDIDATES, decodeCandidates, encodeCandidates, type CheckCandidate } from '@/lib/check-candidates'
import { calculateDepositRisk, cushionLabel, manwon, type DepositRiskInput } from '@/lib/deposit-risk'

export function CheckCandidates({ input, onLoad }: { input: DepositRiskInput | null; onLoad: (input: DepositRiskInput) => void }) {
  const [items, setItems] = useState<CheckCandidate[]>([])
  const [ready, setReady] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [comparing, setComparing] = useState(false)
  const [clearing, setClearing] = useState(false)
  useEffect(() => {
    function refresh() {
      try { setItems(decodeCandidates(localStorage.getItem(CANDIDATES_KEY))); setError('') }
      catch { setItems([]); setError('저장한 후보를 불러오지 못했습니다. 브라우저 저장 권한을 확인하거나 다시 불러오세요.') }
      setReady(true)
    }
    refresh()
    const listener = (event: StorageEvent) => { if (event.key === CANDIDATES_KEY || event.key === null) { refresh(); setNotice('') } }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [])
  function change(update: (current: CheckCandidate[]) => CheckCandidate[], success: string, event?: 'check_candidate_saved' | 'check_checklist_updated') {
    try {
      const current = decodeCandidates(localStorage.getItem(CANDIDATES_KEY))
      const next = update(current)
      localStorage.setItem(CANDIDATES_KEY, encodeCandidates(next))
      setItems(next); setError(''); setNotice(success)
      if (event) track(event, { properties: { surface: 'web', ...getAttribution() } })
    } catch (err) {
      setNotice('')
      setError(err instanceof Error && err.message === 'FULL' ? '후보는 5개까지 저장할 수 있습니다. 필요 없는 후보를 삭제한 뒤 저장하세요.' : '변경 내용을 저장하지 못했습니다. 저장 공간·권한을 확인한 뒤 다시 시도하세요.')
    }
  }
  function save() {
    if (!input) return
    change(current => {
      if (current.length >= MAX_CANDIDATES) throw Error('FULL')
      return [...current, { id: crypto.randomUUID(), label: label.trim() || `후보 ${current.length + 1}`,
        savedAt: new Date().toISOString(), input: { ...input }, checked: CHECKLIST.map(() => false) }]
    }, '이 기기에 후보를 저장했습니다.', 'check_candidate_saved')
  }
  return <Card id="candidates" className="space-y-4 p-5 sm:p-6">
    <h2 className="text-lg font-bold">후보 집 저장·비교</h2>
    <p className="text-sm text-muted-foreground">가입 없이 최대 5개를 이 브라우저에 저장합니다. 금액과 별칭은 서버로 보내지 않습니다. 다른 기기와 동기화되지 않으며 브라우저 데이터를 지우면 사라집니다.</p>
    {input && <div className="space-y-2">
      <label htmlFor="candidate-label" className="text-sm font-semibold">후보 별칭 (선택)</label>
      <Input id="candidate-label" value={label} maxLength={40} placeholder="예: 첫 번째 본 집" onChange={event => setLabel(event.target.value)} />
      <Button type="button" disabled={!ready} onClick={save}>현재 결과를 후보로 저장</Button>
    </div>}
    {!input && <p className="text-sm">위에서 점검을 완료하면 결과를 저장할 수 있습니다.</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p><Button type="button" variant="outline" onClick={() => { try { setItems(decodeCandidates(localStorage.getItem(CANDIDATES_KEY))); setError('') } catch { setError('저장한 후보를 읽지 못했습니다. 저장 권한을 확인하세요. 손상된 데이터는 초기화할 수 있습니다.') } }}>다시 불러오기</Button>
      <Button type="button" variant="outline" onClick={() => setClearing(true)}>저장 데이터 초기화</Button></div>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {ready && !error && items.length === 0 && <p className="text-sm text-muted-foreground">아직 저장한 후보가 없습니다.</p>}
    {items.length >= 2 && <Button type="button" variant="outline" aria-expanded={comparing} onClick={() => { setComparing(!comparing); if (!comparing) track('check_comparison_viewed', { properties: { surface: 'web', ...getAttribution() } }) }}>{comparing ? '비교 접기' : '후보 비교하기'}</Button>}
    {comparing && items.length >= 2 && <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="mb-2 text-left">입력한 숫자 기준 비교</caption><thead><tr><th className="p-2 text-left">항목</th>{items.map(item => <th className="p-2 text-left" key={item.id}>{item.label}</th>)}</tr></thead><tbody>
      {(['marketPriceManwon', 'depositManwon', 'mortgageMaxManwon', 'priorDepositsManwon'] as const).map((key, i) => <tr key={key}><th className="p-2 text-left">{['매매 시세', '보증금', '근저당 채권최고액', '선순위 보증금'][i]}</th>{items.map(item => <td className="p-2" key={item.id}>{manwon(item.input[key])}</td>)}</tr>)}
      <tr><th className="p-2 text-left">시세 대비 부담</th>{items.map(item => <td className="p-2" key={item.id}>{Math.round(calculateDepositRisk(item.input).burdenRatio * 100)}%</td>)}</tr>
      <tr><th className="p-2 text-left">시세대로 팔릴 때</th>{items.map(item => <td className="p-2" key={item.id}>{cushionLabel(calculateDepositRisk(item.input).cushionManwon)}</td>)}</tr>
    </tbody></table></div>}
    {items.map(item => <article key={item.id} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{item.label}</h3>
      <p className="text-xs text-muted-foreground">저장일 {new Date(item.savedAt).toLocaleDateString('ko-KR')} · 시세 {manwon(item.input.marketPriceManwon)} · 보증금 {manwon(item.input.depositManwon)}</p>
      <p className="text-sm">{calculateDepositRisk(item.input).headline}</p>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => { onLoad(item.input); setNotice('저장한 숫자를 점검에 불러왔습니다. 변경 후 다시 확인할 수 있습니다.') }}>이 후보 다시 점검</Button><Button type="button" variant="outline" aria-label={`${item.label} 삭제`} onClick={() => change(current => current.filter(value => value.id !== item.id), '후보를 삭제했습니다.')}>삭제</Button></div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">계약 전 확인 기록 ({item.checked.filter(Boolean).length}/{CHECKLIST.length})</legend>{CHECKLIST.map((text, index) => <label key={text} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={item.checked[index]} onChange={event => change(current => current.map(value => value.id === item.id ? { ...value, checked: value.checked.map((checked, i) => i === index ? event.target.checked : checked) } : value), '확인 기록을 저장했습니다.', 'check_checklist_updated')} />{text}</label>)}</fieldset>
    </article>)}
    {clearing && <div role="alert" className="space-y-2 rounded-lg border p-3"><p className="text-sm">저장한 후보와 확인 기록을 모두 지울까요?</p><Button type="button" onClick={() => { try { localStorage.removeItem(CANDIDATES_KEY); setItems([]); setError(''); setNotice('저장 데이터를 초기화했습니다.'); setClearing(false) } catch { setError('저장 데이터를 지우지 못했습니다. 브라우저 권한을 확인하세요.') } }}>모두 지우기</Button><Button type="button" variant="outline" onClick={() => setClearing(false)}>취소</Button></div>}
    <p className="text-xs text-muted-foreground">확인 표시는 본인이 남기는 기록입니다. 계산 결과와 체크리스트는 계약의 안전을 보장하지 않습니다. 저장 이후 숫자나 등기부가 달라졌다면 다시 확인하세요.</p>
  </Card>
}
