'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  tenantId: string
  variant?: 'default' | 'icon'
  className?: string
  onToggle?: (isFavorited: boolean) => void
}

export function FavoriteButton({
  tenantId,
  variant = 'default',
  className,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkFavoriteStatus()
  }, [tenantId])

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch(`/api/favorites/check?tenantId=${tenantId}`)
      const data = await response.json()
      setIsFavorited(data.isFavorited)
    } catch {
      // 오류 무시 (로그인 안 된 경우 등)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsLoading(true)

    try {
      if (isFavorited) {
        // 즐겨찾기 삭제
        const response = await fetch(`/api/favorites?tenantId=${tenantId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error)
        }

        setIsFavorited(false)
        toast.success('즐겨찾기에서 삭제되었습니다')
        onToggle?.(false)
      } else {
        // 즐겨찾기 추가
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error)
        }

        setIsFavorited(true)
        toast.success('즐겨찾기에 추가되었습니다')
        onToggle?.(true)
      }
    } catch (error) {
      toast.error((error as Error).message || '오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleFavorite}
        disabled={isLoading}
        className={cn(
          'p-2 rounded-full transition-colors',
          isFavorited
            ? 'text-red-500 hover:text-red-600'
            : 'text-muted-foreground hover:text-red-500',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
        aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      >
        <Heart
          className={cn('h-5 w-5', isFavorited && 'fill-current')}
        />
      </button>
    )
  }

  return (
    <Button
      variant={isFavorited ? 'default' : 'outline'}
      size="sm"
      onClick={toggleFavorite}
      disabled={isLoading}
      className={cn(
        isFavorited && 'bg-red-500 hover:bg-red-600 text-white',
        className
      )}
    >
      <Heart className={cn('h-4 w-4 mr-2', isFavorited && 'fill-current')} />
      {isFavorited ? '즐겨찾기 됨' : '즐겨찾기'}
    </Button>
  )
}
