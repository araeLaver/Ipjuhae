'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export const SHARE_CHECK_URL = 'https://www.ipjuhae.com/check?from=friend'
export function ShareCheck() {
  const [notice, setNotice] = useState('')
  return <section className="space-y-2 rounded-lg border p-4" aria-label="보증금 점검 공유">
    <h2 className="text-sm font-bold">집을 구하는 지인에게 알려주세요</h2>
    <p className="text-xs text-muted-foreground">가입 없는 점검 링크만 공유합니다. 입력 금액과 저장한 후보는 공유되지 않습니다.</p>
    <Input aria-label="공유할 점검 링크" readOnly value={SHARE_CHECK_URL} onFocus={event => event.target.select()} />
    <Button type="button" variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(SHARE_CHECK_URL); setNotice('점검 링크를 복사했습니다.') }
      catch { setNotice('아래 링크를 선택해 직접 복사해주세요.') }
    }}>점검 링크 복사</Button>
    {notice && <p role="status" className="text-xs">{notice}</p>}
  </section>
}
