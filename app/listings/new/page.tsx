'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { trackEvent } from '@/lib/analytics-client'

const MAX_PHOTOS = 5

interface FormState {
  monthly_rent: string
  deposit: string
  address: string
  area_sqm: string
  floor: string
  available_from: string
}

interface PreviewFile {
  file: File
  objectUrl: string
  base64?: string
}

export default function NewListingPage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    monthly_rent: '',
    deposit: '',
    address: '',
    area_sqm: '',
    floor: '',
    available_from: '',
  })

  const [previews, setPreviews] = useState<PreviewFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      const remaining = MAX_PHOTOS - previews.length

      if (selected.length > remaining) {
        setError(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다`)
        e.target.value = ''
        return
      }

      setError(null)
      const newPreviews: PreviewFile[] = []
      for (const file of selected) {
        const base64 = await readFileAsBase64(file)
        newPreviews.push({
          file,
          objectUrl: URL.createObjectURL(file),
          base64,
        })
      }
      setPreviews((prev) => [...prev, ...newPreviews])
      e.target.value = ''
    },
    [previews.length]
  )

  function removePhoto(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.monthly_rent || Number(form.monthly_rent) < 1) {
      setError('월세를 입력해주세요 (최소 1만원)')
      return
    }
    if (!form.deposit) {
      setError('보증금을 입력해주세요')
      return
    }
    if (!form.address.trim()) {
      setError('주소를 입력해주세요')
      return
    }
    if (!form.area_sqm || Number(form.area_sqm) <= 0) {
      setError('면적을 입력해주세요')
      return
    }
    if (!form.floor) {
      setError('층수를 입력해주세요')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        monthly_rent: Number(form.monthly_rent),
        deposit: Number(form.deposit),
        address: form.address.trim(),
        area_sqm: Number(form.area_sqm),
        floor: Number(form.floor),
        photo_urls: previews.map((p) => p.base64).filter(Boolean) as string[],
        available_from: form.available_from || undefined,
      }

      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '매물 등록에 실패했습니다')
        setIsSubmitting(false)
        return
      }

      trackEvent('listing_created', {
        listing_id: data.listing?.id,
        monthly_rent: payload.monthly_rent,
        deposit: payload.deposit,
        photo_count: payload.photo_urls.length,
      })
      trackEvent('listing_submitted', {
        listing_id: data.listing?.id,
        timestamp: new Date().toISOString(),
        monthly_rent: payload.monthly_rent,
        deposit: payload.deposit,
        photo_count: payload.photo_urls.length,
      })

      router.push(`/listings/${data.listing.id}`)
    } catch (err) {
      console.error(err)
      setError('알 수 없는 오류가 발생했습니다. 다시 시도해주세요.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">매물 등록</h1>
            <p className="mt-1 text-sm text-muted-foreground">임대할 매물 정보를 입력해주세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 가격 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">가격 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly_rent">월세 (만원) *</Label>
                    <Input
                      id="monthly_rent"
                      name="monthly_rent"
                      type="number"
                      min={1}
                      placeholder="예: 50"
                      value={form.monthly_rent}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deposit">보증금 (만원) *</Label>
                    <Input
                      id="deposit"
                      name="deposit"
                      type="number"
                      min={0}
                      placeholder="예: 500"
                      value={form.deposit}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 매물 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">매물 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="address">주소 *</Label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    placeholder="예: 서울시 마포구 합정동 123-45"
                    value={form.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="area_sqm">면적 (㎡) *</Label>
                    <Input
                      id="area_sqm"
                      name="area_sqm"
                      type="number"
                      min={1}
                      step={0.01}
                      placeholder="예: 33.00"
                      value={form.area_sqm}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="floor">층수 *</Label>
                    <Input
                      id="floor"
                      name="floor"
                      type="number"
                      placeholder="예: 3"
                      value={form.floor}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="available_from">입주 가능일</Label>
                  <Input
                    id="available_from"
                    name="available_from"
                    type="date"
                    value={form.available_from}
                    onChange={handleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 사진 업로드 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">사진 업로드</CardTitle>
                  <span className="text-xs text-muted-foreground">{previews.length} / {MAX_PHOTOS}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {previews.map((p, idx) => (
                      <div key={p.objectUrl} className="relative aspect-square group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.objectUrl}
                          alt={`사진 ${idx + 1}`}
                          className="h-full w-full rounded-lg object-cover border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="사진 삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {previews.length < MAX_PHOTOS && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 text-center hover:border-primary transition-colors"
                    >
                      <span className="text-sm font-medium">사진 추가하기</span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        JPG, PNG, WEBP · {MAX_PHOTOS - previews.length}장 남음
                      </span>
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3 pb-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? '등록 중...' : '매물 등록'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
