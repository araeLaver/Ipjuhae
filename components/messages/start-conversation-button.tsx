'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface StartConversationButtonProps {
  targetUserId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  redirectPath?: string // '/landlord/messages' or '/messages'
}

export function StartConversationButton({
  targetUserId,
  variant = 'default',
  size = 'default',
  className,
  redirectPath = '/landlord/messages',
}: StartConversationButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      router.push(`${redirectPath}/${data.conversationId}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <MessageSquare className="h-4 w-4 mr-2" />
          메시지
        </>
      )}
    </Button>
  )
}
