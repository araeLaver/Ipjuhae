'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { searchLabel, searchUrl, type SavedSearch, type SearchFilters } from '@/lib/saved-search'

interface Props {
  filters: SearchFilters
  onApply: (filters: SearchFilters) => void
}

export function SavedSearches({ filters, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [alertsAvailable, setAlertsAvailable] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    setLoaded(false)
    try {
      const res = await fetch('/api/saved-searches', { cache: 'no-store' })
      if (res.status === 401) { setNeedsLogin(true); setSearches([]); return }
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.searches)) throw new Error(data.error || '저장한 검색을 불러오지 못했습니다')
      setNeedsLogin(false)
      setSearches(data.searches)
      setAlertsAvailable(data.alertsAvailable === true)
      setLoaded(true)
    } catch (err) { setError(err instanceof Error ? err.message : '저장한 검색을 불러오지 못했습니다') }
    finally { setBusy(false) }
  }, [])

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', body: unknown) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/saved-searches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 401) { setNeedsLogin(true); setSearches([]); setLoaded(false); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '요청을 처리하지 못했습니다')
      if (method === 'DELETE') {
        const id = (body as { id: string }).id
        setSearches(previous => previous.filter(search => search.id !== id))
        setMessage('검색 조건을 삭제했습니다')
      } else {
        setSearches(previous => [data.search, ...previous.filter(search => search.id !== data.search.id)])
        setMessage(data.alreadySaved ? '이미 저장한 검색 조건입니다' : method === 'POST' ? '검색 조건을 저장했습니다' : '알림 설정을 변경했습니다')
      }
    } catch (err) { setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다') }
    finally { setBusy(false) }
  }

  return (
    <section className="rounded-lg border p-3 space-y-3" aria-label="저장한 검색">
      <Button variant="outline" size="sm" aria-expanded={open} onClick={() => {
        const next = !open
        setOpen(next)
        if (next) { setMessage(''); void load() }
      }}>저장한 검색</Button>
      {open && (
        <div className="space-y-3">
          {busy && <p role="status" className="text-sm">처리 중…</p>}
          {needsLogin ? (
            <p className="text-sm">검색 조건을 저장하려면 <Link className="text-primary underline" href={`/login?redirect=${encodeURIComponent(searchUrl(filters))}`}>로그인해 주세요</Link>.</p>
          ) : loaded && (
            <>
              <p className="text-sm">현재 조건: {searchLabel(filters)}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alertsEnabled} disabled={busy || !alertsAvailable} onChange={event => setAlertsEnabled(event.target.checked)} />
                새 매물 알림 받기
              </label>
              <p className="text-xs text-muted-foreground">
                {alertsAvailable ? '알림을 켠 이후 등록된 매물을 앱 알림 센터에서 알려드려요. 이메일·문자는 발송하지 않습니다.' : '새 매물 알림은 아직 이용할 수 없습니다. 검색 조건은 저장할 수 있어요.'}
              </p>
              <Button size="sm" disabled={busy} onClick={() => void mutate('POST', { filters, alertsEnabled: alertsAvailable && alertsEnabled })}>현재 검색 조건 저장</Button>
              {searches.length === 0 ? <p className="text-sm text-muted-foreground">저장한 검색 조건이 없습니다</p> : (
                <ul className="space-y-3">
                  {searches.map(search => (
                    <li key={search.id} className="border-t pt-3 space-y-2">
                      <p className="text-sm font-medium">{searchLabel(search)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => onApply(search)}>이 조건으로 검색</Button>
                        <Button variant="outline" size="sm" disabled={busy || (!alertsAvailable && !search.alerts_enabled)} onClick={() => void mutate('PATCH', { id: search.id, alertsEnabled: !search.alerts_enabled })} aria-label={`${searchLabel(search)} 알림 ${search.alerts_enabled ? '끄기' : '켜기'}`}>알림 {search.alerts_enabled ? '끄기' : '켜기'}</Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void mutate('DELETE', { id: search.id })} aria-label={`${searchLabel(search)} 검색 삭제`}>삭제</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {error && <div role="alert" className="text-sm text-destructive">{error}{!loaded && !busy && <Button variant="ghost" size="sm" onClick={() => void load()}>다시 시도</Button>}</div>}
          {message && <p role="status" className="text-sm">{message}</p>}
        </div>
      )}
    </section>
  )
}
