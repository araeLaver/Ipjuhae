'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileImageUpload } from '@/components/profile/profile-image-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import {
  AGE_RANGES,
  FAMILY_TYPES,
  PETS,
  STAY_TIMES,
  DURATIONS,
  NOISE_LEVELS,
} from '@/lib/validations'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Profile } from '@/types/database'

type FormData = {
  name: string
  bio: string
  intro: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  stay_time: string | null
  duration: string | null
  noise_level: string | null
}

const LABEL_MAP = {
  age_range: { '20대초반': '20대 초반', '20대후반': '20대 후반', '30대': '30대', '40대이상': '40대 이상' },
  family_type: { '1인': '혼자', '커플': '커플', '가족': '가족' },
  pets: { '없음': '없음', '강아지': '🐶 강아지', '고양이': '🐱 고양이', '기타': '기타' },
  stay_time: { '아침': '아침/오전', '저녁': '저녁/밤', '주말만': '주말만', '거의없음': '거의 없음' },
  duration: { '6개월': '6개월 이내', '1년': '약 1년', '2년': '약 2년', '장기': '장기 거주' },
  noise_level: { '조용': '🔇 조용', '보통': '🔉 보통', '활발': '🔊 활발' },
} as Record<string, Record<string, string>>

function ToggleButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-colors',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:border-primary'
      )}
    >
      {children}
    </button>
  )
}

export default function ProfileEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    bio: '',
    intro: '',
    age_range: '20대후반',
    family_type: '1인',
    pets: ['없음'],
    smoking: false,
    stay_time: null,
    duration: null,
    noise_level: null,
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/profile')
        if (res.status === 401) { router.push('/login'); return }
        const data = await res.json()
        if (!data.profile) { router.push('/onboarding/basic'); return }

        const p: Profile = data.profile
        setProfileImage(data.profileImage || null)
        setForm({
          name: p.name || '',
          bio: p.bio || '',
          intro: p.intro || '',
          age_range: p.age_range || '20대후반',
          family_type: p.family_type || '1인',
          pets: p.pets?.length ? p.pets : ['없음'],
          smoking: p.smoking ?? false,
          stay_time: p.stay_time || null,
          duration: p.duration || null,
          noise_level: p.noise_level || null,
        })
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const togglePet = (pet: string) => {
    if (pet === '없음') {
      set('pets', ['없음'])
      return
    }
    const current = form.pets.filter(p => p !== '없음')
    if (current.includes(pet)) {
      const next = current.filter(p => p !== pet)
      set('pets', next.length ? next : ['없음'])
    } else {
      set('pets', [...current, pet])
    }
  }

  const handleSave = async () => {
    setSaveError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_complete: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      router.push('/profile')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageContainer maxWidth="sm">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="sm">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">프로필 수정</h1>
        </div>

        {/* 프로필 이미지 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">프로필 사진</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ProfileImageUpload
              name={form.name}
              imageUrl={profileImage}
              onImageChange={setProfileImage}
              showDropZone
            />
          </CardContent>
        </Card>

        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 이름 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이름 *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                maxLength={50}
                placeholder="이름을 입력하세요"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* 한마디 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">한마디</label>
              <input
                type="text"
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
                maxLength={100}
                placeholder="나를 한 마디로 표현하면?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground text-right">{form.bio.length}/100</p>
            </div>

            {/* 자기소개 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">자기소개</label>
              <textarea
                value={form.intro}
                onChange={e => set('intro', e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="나를 더 알려주세요 (취미, 직업, 생활패턴 등)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{form.intro.length}/500</p>
            </div>

            {/* 연령대 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">연령대</label>
              <div className="flex flex-wrap gap-2">
                {AGE_RANGES.map(r => (
                  <ToggleButton key={r} selected={form.age_range === r} onClick={() => set('age_range', r)}>
                    {LABEL_MAP.age_range[r] ?? r}
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* 가구 유형 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">가구 유형</label>
              <div className="flex flex-wrap gap-2">
                {FAMILY_TYPES.map(f => (
                  <ToggleButton key={f} selected={form.family_type === f} onClick={() => set('family_type', f)}>
                    {LABEL_MAP.family_type[f] ?? f}
                  </ToggleButton>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 라이프스타일 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">라이프스타일</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 반려동물 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">반려동물</label>
              <div className="flex flex-wrap gap-2">
                {PETS.map(p => (
                  <ToggleButton key={p} selected={form.pets.includes(p)} onClick={() => togglePet(p)}>
                    {LABEL_MAP.pets[p] ?? p}
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* 흡연 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">흡연 여부</label>
              <div className="flex gap-2">
                <ToggleButton selected={!form.smoking} onClick={() => set('smoking', false)}>
                  🚭 비흡연
                </ToggleButton>
                <ToggleButton selected={form.smoking} onClick={() => set('smoking', true)}>
                  🚬 흡연
                </ToggleButton>
              </div>
            </div>

            {/* 집에 있는 시간 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">주로 집에 있는 시간</label>
              <div className="flex flex-wrap gap-2">
                {STAY_TIMES.map(s => (
                  <ToggleButton
                    key={s}
                    selected={form.stay_time === s}
                    onClick={() => set('stay_time', form.stay_time === s ? null : s)}
                  >
                    {LABEL_MAP.stay_time[s] ?? s}
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* 희망 거주기간 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">희망 거주기간</label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map(d => (
                  <ToggleButton
                    key={d}
                    selected={form.duration === d}
                    onClick={() => set('duration', form.duration === d ? null : d)}
                  >
                    {LABEL_MAP.duration[d] ?? d}
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* 생활 소음 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">생활 소음 수준</label>
              <div className="flex flex-wrap gap-2">
                {NOISE_LEVELS.map(n => (
                  <ToggleButton
                    key={n}
                    selected={form.noise_level === n}
                    onClick={() => set('noise_level', form.noise_level === n ? null : n)}
                  >
                    {LABEL_MAP.noise_level[n] ?? n}
                  </ToggleButton>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 에러 + 저장 */}
        {saveError && (
          <p className="text-sm text-destructive text-center">{saveError}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="w-full"
          size="lg"
        >
          {saving ? (
            <>잠시만요...</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              저장하기
            </>
          )}
        </Button>

        <div className="h-8" />
      </div>
    </PageContainer>
  )
}
