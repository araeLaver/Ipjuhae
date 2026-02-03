'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, CheckCircle, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { DocumentStatus, DocumentType } from '@/types/database'

interface DocumentUploadProps {
  type: DocumentType
  label: string
  onUploaded: (docId: string) => void
}

const statusConfig: Record<DocumentStatus, { icon: typeof Clock; label: string; color: string }> = {
  pending: { icon: Clock, label: '대기 중', color: 'text-muted-foreground' },
  processing: { icon: Clock, label: '처리 중', color: 'text-warning' },
  approved: { icon: CheckCircle, label: '승인됨', color: 'text-success' },
  rejected: { icon: XCircle, label: '반려됨', color: 'text-destructive' },
}

export function DocumentUpload({ type, label, onUploaded }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<DocumentStatus | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const maxSize = 10 * 1024 * 1024
    if (selected.size > maxSize) {
      toast.error('파일 크기는 10MB 이하여야 합니다')
      return
    }

    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)

    try {
      const res = await fetch('/api/verifications/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: type,
          fileName: file.name,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setStatus('pending')
      onUploaded(data.document.id)
      toast.success('서류가 업로드되었습니다')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const statusInfo = status ? statusConfig[status] : null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">{label}</h4>
          {statusInfo && (
            <span className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
              <statusInfo.icon className="h-3.5 w-3.5" />
              {statusInfo.label}
            </span>
          )}
        </div>

        {!status ? (
          <div className="space-y-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">클릭하여 파일 선택</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (최대 10MB)</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            {file && (
              <Button
                onClick={handleUpload}
                loading={uploading}
                size="sm"
                className="w-full"
              >
                업로드
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {status === 'pending' && '서류가 접수되었습니다. 검토까지 잠시 기다려주세요.'}
            {status === 'processing' && '서류를 검토 중입니다.'}
            {status === 'approved' && '서류 인증이 완료되었습니다.'}
            {status === 'rejected' && '서류가 반려되었습니다. 다시 제출해주세요.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
