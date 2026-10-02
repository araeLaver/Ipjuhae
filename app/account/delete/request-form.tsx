'use client'
import { useState } from 'react'
export default function DeleteAccountForm() {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (!confirmed || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || '처리하지 못했습니다. 다시 시도해주세요.')
      } else window.location.assign('/login?deleted=1')
    } catch { setError('연결하지 못했습니다. 다시 시도해주세요.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <label className="block"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> 삭제 범위와 복구 불가 안내를 확인했습니다.</label>
    <button className="rounded bg-red-700 text-white p-3 disabled:opacity-50" disabled={!confirmed || busy} onClick={submit}>{busy ? '처리 중…' : '계정 삭제 요청'}</button>
    {error && <p role="alert">{error}</p>}
  </div>
}
