'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trackEvent } from '@/lib/analytics'

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

  // ── form field change ──────────────────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // ── photo selection ────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      const remaining = MAX_PHOTOS - previews.length

      if (selected.length > remaining) {
        setError(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다`)
        e.target.value = ''
        return
      }

      setError(null)
      const newPreviews = selected.map((file) => ({
        file,
        objectUrl: URL.createObjectURL(file),
      }))
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

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // client-side validation
    if (!form.monthly_rent || Number(form.monthly_rent) < 1) {
      setError('월세를 입력해주세요 (최소 1만원)')
      return
    }
    if (!form.address.trim()) {
      setError('주소를 입력해주세요')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. upload photos (if any)
      let photoUrls: string[] = []

      if (previews.length > 0) {
        const fd = new FormData()
        previews.forEach((p) => fd.append('photos', p.file))

        const uploadRes = await fetch('/api/listings/upload', {
          method: 'POST',
          body: fd,
        })
        const uploadData = await uploadRes.json()

        if (!uploadRes.ok) {
          setError(uploadData.error ?? '사진 업로드에 실패했습니다')
          setIsSubmitting(false)
          return
        }

        photoUrls = uploadData.urls as string[]
      }

      // 2. create listing
      const payload = {
        monthly_rent: Number(form.monthly_rent),
        deposit: Number(form.deposit) || 0,
        address: form.address.trim(),
        area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
        floor: form.floor ? Number(form.floor) : null,
        photo_urls: photoUrls,
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

      // success → redirect to listings
      trackEvent('listing_created', {
        monthly_rent: Number(form.monthly_rent),
        deposit: Number(form.deposit),
        photo_count: previews.length,
      })
      router.push('/listings')
    } catch (err) {
      console.error(err)
      setError('알 수 없는 오류가 발생했습니다. 다시 시도해주세요.')
      setIsSubmitting(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">매물 등록</h1>
        <p className="mt-1 text-sm text-gray-500">임대할 매물 정보를 입력해주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 가격 정보 ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-800">가격 정보</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="monthly_rent">
                월세 (만원) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="monthly_rent"
                  name="monthly_rent"
                  type="number"
                  min={1}
                  placeholder="예: 50"
                  value={form.monthly_rent}
                  onChange={handleChange}
                  required
                  className="pr-10"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
                  만원
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deposit">
                보증금 (만원) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="deposit"
                  name="deposit"
                  type="number"
                  min={0}
                  placeholder="예: 500"
                  value={form.deposit}
                  onChange={handleChange}
                  required
                  className="pr-10"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
                  만원
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 매물 정보 ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-800">매물 정보</h2>

          <div className="space-y-1.5">
            <Label htmlFor="address">
              주소 <span className="text-red-500">*</span>
            </Label>
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
              <Label htmlFor="area_sqm">
                면적 (㎡) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="area_sqm"
                  name="area_sqm"
                  type="number"
                  min={1}
                  step={0.01}
                  placeholder="예: 33.00"
                  value={form.area_sqm}
                  onChange={handleChange}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
                  ㎡
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor">
                층수 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="floor"
                  name="floor"
                  type="number"
                  placeholder="예: 3"
                  value={form.floor}
                  onChange={handleChange}
                  className="pr-6"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
                  층
                </span>
              </div>
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
        </section>

        {/* ── 사진 업로드 ───────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">사진 업로드</h2>
            <span className="text-xs text-gray-400">{previews.length} / {MAX_PHOTOS}</span>
          </div>

          {/* preview grid */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {previews.map((p, idx) => (
                <div key={p.objectUrl} className="relative aspect-square group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.objectUrl}
                    alt={`사진 ${idx + 1}`}
                    className="h-full w-full rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="사진 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* file input trigger */}
          {previews.length < MAX_PHOTOS && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl mb-2">📷</span>
                <span className="text-sm font-medium text-gray-700">
                  사진 추가하기
                </span>
                <span className="mt-1 text-xs text-gray-400">
                  JPG, PNG, WEBP · 최대 10MB · {MAX_PHOTOS - previews.length}장 남음
                </span>
              </label>
            </div>
          )}
        </section>

        {/* ── 오류 메시지 ───────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── 제출 버튼 ─────────────────────────────────────────────────── */}
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
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? '등록 중...' : '매물 등록'}
          </Button>
        </div>
      </form>
    </div>
  )
}
