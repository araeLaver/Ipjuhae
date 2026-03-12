'use client'

import { useState, useRef, useCallback } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, X, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileImageUploadProps {
  name?: string
  imageUrl?: string | null
  onImageChange: (imageUrl: string | null) => void
  /** 드래그앤드롭 영역 전체 표시 여부 (기본: false = 아바타 클릭만) */
  showDropZone?: boolean
}

export function ProfileImageUpload({
  name,
  imageUrl,
  onImageChange,
  showDropZone = false,
}: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > 10 * 1024 * 1024) return '파일 크기는 10MB 이하여야 합니다'
    if (!file.type.startsWith('image/')) return '이미지 파일만 업로드 가능합니다'
    return null
  }

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // 미리보기 생성
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
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
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패')
      setPreview(null)
    } finally {
      setIsUploading(false)
      URL.revokeObjectURL(previewUrl)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onImageChange])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDelete = async () => {
    setIsUploading(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/image', { method: 'DELETE' })
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

  // 드래그앤드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const displayImage = preview || imageUrl

  // 드롭존 모드 (프로필 수정 페이지용)
  if (showDropZone) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'relative w-32 h-32 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all',
            isDragging
              ? 'border-primary bg-primary/10 scale-105'
              : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50',
            isUploading && 'cursor-not-allowed opacity-60'
          )}
        >
          {displayImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayImage}
                alt="프로필 미리보기"
                className="w-full h-full rounded-full object-cover"
              />
              {!isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground px-4 text-center">
              <Upload className="h-8 w-8" />
              <span className="text-xs leading-tight">
                {isDragging ? '여기에 놓기' : '클릭 또는 드래그'}
              </span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          {imageUrl && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              사진 삭제
            </Button>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          {!displayImage && !error && (
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP · 최대 10MB</p>
          )}
        </div>
      </div>
    )
  }

  // 기본 모드 (프로필 뷰 페이지용 — 아바타 클릭)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn('cursor-pointer transition-opacity', isUploading && 'opacity-50')}
        >
          {displayImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayImage}
              alt="프로필 사진"
              className="h-24 w-24 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <Avatar name={name} imageUrl={null} size="xl" />
          )}
        </div>

        {!isUploading && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="h-6 w-6 text-white" />
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {imageUrl && !isUploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4 mr-1" />
          사진 삭제
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!displayImage && !error && (
        <p className="text-sm text-muted-foreground">클릭하여 프로필 사진 추가</p>
      )}
    </div>
  )
}
