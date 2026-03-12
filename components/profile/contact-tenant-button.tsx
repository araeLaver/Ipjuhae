'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface ContactTenantButtonProps {
  targetUserId: string
  targetName: string
}

export function ContactTenantButton({ targetUserId, targetName }: ContactTenantButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return

    setIsSending(true)
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, initialMessage: message.trim() }),
      })

      if (res.status === 401) {
        toast.info('로그인 후 이용해주세요')
        router.push('/login')
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '메시지 전송에 실패했습니다')

      toast.success('메시지를 보냈습니다')
      setOpen(false)
      router.push(`/landlord/messages/${data.conversationId}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <Button className="w-full gap-2" size="lg" onClick={() => setOpen(true)}>
        <MessageSquare className="h-4 w-4" />
        {targetName}님에게 연락하기
      </Button>

      {/* 인라인 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isSending && setOpen(false)}
          />

          {/* 모달 */}
          <div className="relative z-10 w-full max-w-md bg-background rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{targetName}님에게 메시지 보내기</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  입주 의사나 궁금한 점을 자유롭게 적어보세요.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={isSending}
                className="text-muted-foreground hover:text-foreground ml-2 mt-0.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1">
              <Textarea
                placeholder="안녕하세요, 프로필 보고 연락드립니다..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
                취소
              </Button>
              <Button onClick={handleSend} disabled={!message.trim() || isSending}>
                {isSending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                보내기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
