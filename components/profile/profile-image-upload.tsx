'use client'

import { useState, useRef } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileImageUploadProps {
  name?: string
  imageUrl?: string | null
  onImageChange: (imageUrl: string | null) => void
}

export function ProfileImageUpload({
  name,
  imageUrl,
  onImageChange,
}: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다')
      return
    }

    // 이미지 타입 검증
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/profile/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '업로드 실패')
      }

      onImageChange(data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setIsUploading(false)
      // 같은 파일 재선택 가능하도록 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    setIsUploading(true)
    setError(null)

    try {
      const response = await fetch('/api/profile/image', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '삭제 실패')
      }

      onImageChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        {/* 아바타 */}
        <div
          onClick={handleClick}
          className={cn(
            'cursor-pointer transition-opacity',
            isUploading && 'opacity-50'
          )}
        >
          <Avatar name={name} imageUrl={imageUrl} size="xl" />
        </div>

        {/* 호버 오버레이 */}
        {!isUploading && (
          <div
            onClick={handleClick}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="h-6 w-6 text-white" />
          </div>
        )}

        {/* 업로드 중 스피너 */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 삭제 버튼 (이미지가 있을 때만) */}
      {imageUrl && !isUploading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4 mr-1" />
          사진 삭제
        </Button>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 안내 텍스트 */}
      {!imageUrl && !error && (
        <p className="text-sm text-muted-foreground">
          클릭하여 프로필 사진 추가
        </p>
      )}
    </div>
  )
}
