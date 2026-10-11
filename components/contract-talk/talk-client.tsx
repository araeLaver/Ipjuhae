'use client'
import Link from 'next/link'
import { FeatureRequestForm } from '@/components/feedback/feature-request-form'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/lib/contract-talk/prompts'
import type { Action, TalkView } from '@/lib/contract-talk/service'

const button = 'rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40'
const field = 'mt-2 w-full rounded-lg border bg-background p-3'
function timeLabel(value: string) { return new Date(value).toLocaleString('ko-KR', { timeZoneName: 'short' }) }
function localTime(value: string) {
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const stageLabel = { requested: '요청 생성 · 상대 응답 대기', responded: '상대 응답 있음', conversation_completed: '양측 대화 완료', confirmed: '양측 확인 완료' }
class RequestError extends Error { constructor(message: string, public status: number) { super(message) } }
async function request(endpoint: string, method = 'GET', body?: unknown): Promise<TalkView> {
  const res = await fetch(endpoint, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json() as {talk?:TalkView; error?:string}
  if (!res.ok || !data.talk) throw new RequestError(data.error ?? '요청을 불러오지 못했습니다.', res.status)
  return data.talk
}
function Intro() {
  return <><p className="text-sm text-primary">계약 전 대화 준비</p><h1 className="mt-2 text-2xl font-bold">계약 전 대화 요청</h1><p className="mt-3 text-sm text-muted-foreground">집을 구하는 임차인이 질문 세 가지와 가능한 시간을 정리해 임대인에게 직접 링크를 공유하는 곳입니다. 상대 답변과 제안 시간을 확인하고 합의할 수 있습니다. 이름·연락처·소득·신분증 같은 개인정보는 적지 마세요. 답변과 상호 확인 기록을 정리하는 기능입니다.</p><p className="mt-2 text-xs text-muted-foreground">공유 링크는 7일 후 만료됩니다. 만료 후 30일이 지난 기록은 매일 정리합니다. 확인 완료는 당사자의 표시이며 사실 진위나 계약의 법적 안전을 보장하지 않습니다.</p></>
}
export function CreateTalk() {
  const router = useRouter()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [slots, setSlots] = useState(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  const key = useRef('')
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('contract-talk-draft') ?? 'null') as {slots?:string[];key?:string;email?:string} | null
      if (saved?.slots?.length === 3 && saved.slots.every(s => typeof s === 'string') && typeof saved.key === 'string') { setSlots(saved.slots); key.current = saved.key; setRecipientEmail(saved.email??'') }
    } catch { /* 손상된 로컬 초안은 사용하지 않는다. */ }
  }, [])
  function changeSlot(index: number, value: string) {
    const next = [...slots]; next[index] = value; setSlots(next)
    if (!key.current) key.current = crypto.randomUUID()
    sessionStorage.setItem('contract-talk-draft', JSON.stringify({ slots: next, key: key.current, email:recipientEmail }))
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      if (!key.current) key.current = crypto.randomUUID()
      const talk = await request('/api/contract-talk', 'POST', { recipientEmail, clientKey: key.current, slots: slots.filter(Boolean).map(s => new Date(s).toISOString()) })
      router.push(`/contract-talk/${talk.id}`)
    } catch (e) { setError((e as Error).message) }
    finally { sending.current = false; setBusy(false) }
  }
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-10"><Intro /><p className="text-sm">요청을 만들려면 <Link className="underline" href="/login?redirect=%2Fcontract-talk">로그인</Link>하거나 <Link className="underline" href="/signup?redirect=%2Fcontract-talk">가입 후 이 화면으로 돌아오세요</Link>. 입력한 이메일과 시간은 이 탭의 초안으로 유지됩니다.</p><Link className="block underline" href="/contract-talk/requests">보낸·받은 요청 보기</Link><form onSubmit={submit} className="space-y-6" aria-label="대화 요청 만들기"><ol className="space-y-3">{QUESTIONS.map(q => <li key={q} className="rounded-lg border p-4">{q}</li>)}</ol><label className="block text-sm font-semibold">상대 임대인의 입주해 계정 이메일<input type="email" required maxLength={254} autoComplete="off" className={field} value={recipientEmail} onChange={e=>{if(e.target.value!==recipientEmail)key.current=crypto.randomUUID();setRecipientEmail(e.target.value);sessionStorage.setItem('contract-talk-draft',JSON.stringify({slots,key:key.current,email:e.target.value}))}} /><span className="mt-2 block text-xs font-normal text-muted-foreground">상대가 아직 가입하지 않았다면 가입할 이메일을 확인하세요. 해당 이메일의 임대인 계정으로만 링크를 열 수 있습니다. 메일은 자동 발송하지 않습니다.</span></label><fieldset><legend className="font-semibold">가능한 시간 (최대 3개)</legend><p className="mt-1 text-xs text-muted-foreground">이 브라우저의 시간대 기준입니다. 30일 이내로 선택하세요.</p>{slots.map((s,i) => <label key={i} className="mt-3 block text-sm">가능한 시간 {i+1}<input className={field} type="datetime-local" required={i===0} value={s} onChange={e => changeSlot(i,e.target.value)} /></label>)}</fieldset>{error && <p role="alert">{error}</p>}<div className="flex gap-3"><button className={button} disabled={busy} type="submit">{busy ? '만드는 중…' : '요청 만들기'}</button><button type="button" className={button} disabled={busy} onClick={() => { key.current=crypto.randomUUID();setSlots(['','','']);sessionStorage.removeItem('contract-talk-draft');setError('') }}>새 요청 시작</button></div></form><Link className="underline" href="/login?redirect=%2Fcontract-talk">기존 계정 로그인</Link><FeatureRequestForm source="contract-talk" /></main>
}
export function TalkDetail({ id, shared = false }: {id:string; shared?:boolean}) {
  const endpoint = `/api/contract-talk/${shared ? 'shared/' : ''}${id}`
  const [talk, setTalk] = useState<TalkView | null>(null)
  const [answers, setAnswers] = useState(['','',''])
  const [proposal, setProposal] = useState('')
  const [editSlots, setEditSlots] = useState(['','',''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const sending = useRef(false)
  const load = useCallback(async () => {
    try { const t = await request(endpoint);setTalk(t);setAnswers(t.answers);setProposal(t.proposedTime ? localTime(t.proposedTime) : '');setEditSlots([...t.slots.map(localTime),'',''].slice(0,3)) } catch (e) { if (e instanceof RequestError && [401,403,404,410].includes(e.status)) setTalk(null); throw e }
  }, [endpoint])
  useEffect(() => { let live = true;request(endpoint).then(t => { if (live) {setTalk(t);setAnswers(t.answers);setProposal(t.proposedTime ? localTime(t.proposedTime) : '');setEditSlots([...t.slots.map(localTime),'',''].slice(0,3))} }).catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false} },[endpoint])
  async function change(action: Action) {
    if (!talk || sending.current) return
    sending.current=true;setBusy(true);setError('')
    try { setTalk(await request(endpoint,'PATCH',{version:talk.version,change:action})) }
    catch(e) { setError((e as Error).message); if (e instanceof RequestError && [401,403,404,410].includes(e.status)) setTalk(null); else {try{await load()}catch{/* 접근 차단 시 이전 내용을 남기지 않는다. */}} }
    finally {sending.current=false;setBusy(false)}
  }
  const role = talk?.viewerRole
  const disabled = busy || Boolean(talk?.inactive) || talk?.progress === 'confirmed'
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-10"><Intro />{error && <p role="alert" className="rounded-lg border p-3">{error}</p>}{!talk ? <><p>{error ? '링크와 접근 권한을 확인해주세요.' : '요청을 확인하고 있습니다.'}</p><Link href={`/login?redirect=${encodeURIComponent(`/contract-talk/${shared?'shared/':''}${id}`)}`} className="underline">기존 계정 로그인</Link><Link href={`/signup?redirect=${encodeURIComponent(`/contract-talk/${shared?'shared/':''}${id}`)}`} className="ml-4 underline">임대인 계정 가입 후 이 요청으로 돌아오기</Link><Link href="/contract-talk/requests" className="block underline">보낸·받은 요청 확인하기</Link><FeatureRequestForm source="contract-talk" /></> : <>
    <section className="rounded-xl border p-5"><h2 className="font-bold" data-testid="talk-stage">{talk.cancelled ? '요청 취소됨' : talk.inactive ? '요청 만료됨' : stageLabel[talk.progress]}</h2><p className="mt-2 text-sm">현재 역할: {role==='tenant'?'임차인':'임대인'} · 만료 {timeLabel(talk.expiresAt)}</p><p className="mt-2 text-xs text-muted-foreground">링크 생성·복사는 상대 전달이나 열람을 뜻하지 않습니다. 상대 응답은 답변 저장 후 표시됩니다.</p><button className={`${button} mt-3`} disabled={busy} onClick={()=>{setError('');load().catch(e=>setError((e as Error).message))}}>최신 내용 확인</button></section>
    {role==='tenant' && !talk.inactive && talk.shareId && <section className="rounded-xl border p-5"><h2 className="font-semibold">직접 링크 전달</h2><p className="mt-2 text-sm">응답할 임대인에게만 공유하세요. 지정한 이메일로 로그인한 임대인과 요청자만 내용을 볼 수 있습니다.</p><label className="mt-3 block text-sm">공유 링크<input className={field} readOnly value={typeof window==='undefined'?'':`${window.location.origin}/contract-talk/shared/${talk.shareId}`} /></label><button className={`${button} mt-3`} disabled={busy} onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/contract-talk/shared/${talk.shareId}`);setCopied(true)}catch{setError('공유 링크를 직접 선택해 복사해주세요.')}}}>{copied?'링크 복사됨':'링크 복사'}</button></section>}
    <section><h2 className="font-semibold">가능한 시간</h2><ul className="mt-2 space-y-1">{talk.slots.map(s=><li key={s}>{timeLabel(s)}</li>)}</ul>{role==='tenant' && talk.progress==='requested' && !talk.inactive && <details className="mt-4"><summary>응답 전 일정 수정</summary>{editSlots.map((s,i)=><label key={i} className="mt-2 block">수정 시간 {i+1}<input type="datetime-local" className={field} value={s} onChange={e=>{const next=[...editSlots];next[i]=e.target.value;setEditSlots(next)}} /></label>)}<button className={`${button} mt-3`} disabled={busy} onClick={()=>change({action:'edit',slots:editSlots.filter(Boolean).map(s=>new Date(s).toISOString())})}>일정 저장</button></details>}</section>
    <section className="space-y-4"><h2 className="font-bold">답변 · 합의 · 추가 확인</h2>{talk.questions.map((q,i)=>{const needs=talk.needsCheck.tenant[i]||talk.needsCheck.landlord[i];const agreed=talk.accepted.tenant[i]&&talk.accepted.landlord[i];return <article key={q} className="rounded-xl border p-4"><h3 className="font-semibold">{q}</h3><p className="mt-2 text-sm" data-testid={`category-${i}`}>{needs?'추가 확인 필요':agreed?'양측 합의':talk.answers[i]?'답변 있음':'답변 대기'}</p><p className="mt-3 whitespace-pre-wrap">{talk.answers[i]||'아직 답변이 없습니다.'}</p><p className="mt-2 text-xs text-muted-foreground">합의: 임차인 {talk.accepted.tenant[i]?'동의':'대기'} · 임대인 {talk.accepted.landlord[i]?'동의':'대기'}</p>{needs && <p className="mt-1 text-xs">추가 확인: 임차인 {talk.needsCheck.tenant[i]?'필요':'표시 없음'} · 임대인 {talk.needsCheck.landlord[i]?'필요':'표시 없음'}</p>}{talk.progress!=='requested' && <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={disabled||!talk.answers[i]} aria-pressed={talk.accepted[role!][i]} onClick={()=>change({action:'accept',index:i,value:!talk.accepted[role!][i]})}>{talk.accepted[role!][i]?'내 합의 철회':'이 답변에 합의'}</button><button className={button} disabled={disabled} aria-pressed={talk.needsCheck[role!][i]} onClick={()=>change({action:'check',index:i,value:!talk.needsCheck[role!][i]})}>{talk.needsCheck[role!][i]?'내 추가 확인 해소':'추가 확인 필요 표시'}</button></div>}</article>})}</section>
    {role==='landlord' && !talk.inactive && !talk.conversationDone.tenant && !talk.conversationDone.landlord && <form aria-label="임대인 답변" className="space-y-4" onSubmit={e=>{e.preventDefault();change({action:'respond',answers,proposedTime:proposal?new Date(proposal).toISOString():null})}}><h2 className="font-semibold">답변 또는 시간 제안</h2>{talk.questions.map((q,i)=><label key={q} className="block">답변 {i+1}<textarea aria-label={`답변 ${i+1}`} maxLength={500} className={field} value={answers[i]} onChange={e=>{const next=[...answers];next[i]=e.target.value;setAnswers(next)}} /></label>)}<label className="block">제안 시간<input type="datetime-local" className={field} value={proposal} onChange={e=>setProposal(e.target.value)} /></label><button className={button} disabled={disabled} type="submit">답변 저장</button></form>}
    {talk.proposedTime && <section className="rounded-xl border p-4"><h2 className="font-semibold">제안 시간</h2><p className="mt-2">{timeLabel(talk.proposedTime)}</p><p className="mt-2">{talk.timeAccepted?'양측 일정 합의':'요청자 확인 대기'}</p>{role==='tenant' && <button className={`${button} mt-3`} disabled={disabled} onClick={()=>change({action:'accept_time',value:!talk.timeAccepted})}>{talk.timeAccepted?'일정 합의 철회':'제안 시간에 합의'}</button>}</section>}
    {!talk.inactive && talk.progress!=='requested' && <section className="rounded-xl border p-4 space-y-3"><h2 className="font-semibold">완료 상태 구분</h2><p className="text-sm">대화 완료: 임차인 {talk.conversationDone.tenant?'완료':'대기'} · 임대인 {talk.conversationDone.landlord?'완료':'대기'}</p><button className={button} disabled={disabled||talk.conversationDone[role!]} onClick={()=>change({action:'conversation_done'})}>내 대화 완료</button><p className="text-sm">확인 완료: 임차인 {talk.confirmed.tenant?'완료':'대기'} · 임대인 {talk.confirmed.landlord?'완료':'대기'}</p><p className="text-xs text-muted-foreground">세 답변을 양측이 합의하고 추가 확인을 해소한 뒤, 각자 확인 완료를 표시합니다. 당사자의 기록이며 사실 진위나 계약의 법적 안전을 보장하지 않습니다.</p><button className={button} disabled={disabled||!talk.canConfirm||talk.confirmed[role!]} onClick={()=>change({action:'confirm'})}>내 확인 완료</button></section>}
    {!talk.inactive && (talk.conversationDone.tenant || talk.conversationDone.landlord) && <button className={button} disabled={busy} onClick={()=>change({action:'reopen'})}>정정 위해 대화 다시 열기</button>}
    {role==='tenant' && !talk.inactive && <button className={button} disabled={busy} onClick={()=>{if(window.confirm('요청을 취소하면 상대 링크로 더 이상 응답할 수 없습니다. 취소할까요?'))change({action:'cancel'})}}>요청 취소</button>}
    <Link className="block underline" href="/contract-talk/requests">보낸·받은 요청 보기</Link><Link className="block underline" href="/contract-talk">요청 만들기로 돌아가기</Link><FeatureRequestForm source="contract-talk" />
  </>}</main>
}

export function TalkInbox() {
 const [items,setItems]=useState<import('@/lib/contract-talk/service').TalkSummary[]>([])
 const [error,setError]=useState(''),[loading,setLoading]=useState(true)
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const r=await fetch('/api/contract-talk',{cache:'no-store'});const data=await r.json()
  if(!r.ok)throw new Error(data.error??'목록을 불러오지 못했습니다.')
  setItems(data.requests)
 }catch(e){setItems([]);setError((e as Error).message)}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 const labels:Record<string,string>={...stageLabel,cancelled:'요청 취소됨',expired:'요청 만료됨'}
 return <main className="mx-auto max-w-2xl space-y-5 px-5 py-10"><h1 className="text-2xl font-bold">보낸·받은 대화 요청</h1><p className="text-sm">본인이 보내거나 지정된 임대인으로 받은 최근 요청 100개입니다.</p>
 <button className={button} disabled={loading} onClick={()=>void load()}>목록 새로고침</button>{error&&<p role="alert">{error}</p>}
 {error&&<Link className="block underline" href="/login?redirect=%2Fcontract-talk%2Frequests">로그인하고 목록으로 돌아오기</Link>}
 {!loading&&!error&&!items.length&&<p>아직 보낸·받은 요청이 없습니다.</p>}
 <ul className="space-y-3">{items.map(t=><li key={t.id} className="rounded-xl border p-4"><Link className="block font-semibold underline" href={`/contract-talk/${t.shared?'shared/':''}${t.key}`}>{t.direction==='sent'?'보낸 요청':'받은 요청'} · {labels[t.progress]}</Link><p className="mt-2 text-sm">만료 {timeLabel(t.expiresAt)}</p>{t.proposedTime&&<p className="mt-1 text-sm">제안 {timeLabel(t.proposedTime)} · {t.timeAccepted?'일정 합의':'확인 대기'}</p>}</li>)}</ul>
 <Link className="block underline" href="/contract-talk">새 대화 요청 만들기</Link><FeatureRequestForm source="contract-talk" /></main>
}
