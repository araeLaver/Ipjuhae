'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy, Share2 } from 'lucide-react'

interface ShareButtonProps {
  profileId: string
}

export function ShareButton({ profileId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${profileId}`
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '렌트미 - 세입자 프로필',
          text: '제 세입자 프로필을 확인해주세요!',
          url: shareUrl,
        })
      } catch (error) {
        // User cancelled sharing
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to share:', error)
        }
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleShare} className="w-full">
        <Share2 className="h-4 w-4 mr-2" />
        프로필 공유하기
      </Button>

      <div className="flex gap-2">
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
        />
        <Button variant="outline" size="icon" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
