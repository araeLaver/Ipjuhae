'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AiIntroGeneratorProps {
  onGenerated: (text: string) => void
}

export function AiIntroGenerator({ onGenerated }: AiIntroGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/profile/generate-intro', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '생성에 실패했습니다')
      }

      onGenerated(data.intro)
      setHasGenerated(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="text-primary"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : hasGenerated ? (
          <RefreshCw className="h-4 w-4 mr-1" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1" />
        )}
        {isGenerating ? '생성 중...' : hasGenerated ? '다시 생성' : 'AI로 자기소개서 작성'}
      </Button>
    </div>
  )
}
