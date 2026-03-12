'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, X } from 'lucide-react'
import { TenantFilters, DEFAULT_FILTERS } from '@/hooks/useTenantSearch'
import {
  FAMILY_TYPES,
  PETS,
  DURATIONS,
  NOISE_LEVELS,
  SORT_OPTIONS,
} from '@/lib/validations'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

const SORT_LABELS: Record<string, string> = {
  trust_desc: '신뢰점수 높은 순',
  created_desc: '최근 가입 순',
  reference_desc: '레퍼런스 많은 순',
  verified_desc: '인증 많은 순',
}

const VERIFIED_OPTIONS = [
  { value: 'employment', label: '재직인증' },
  { value: 'income', label: '소득인증' },
  { value: 'credit', label: '신용인증' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: readonly string[] | string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selected.includes(opt)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface TenantSearchFiltersProps {
  filters: TenantFilters
  onChange: (filters: TenantFilters) => void
  onReset: () => void
}

export function TenantSearchFilters({ filters, onChange, onReset }: TenantSearchFiltersProps) {
  const update = <K extends keyof TenantFilters>(key: K, value: TenantFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const hasActiveFilters =
    filters.region.length > 0 ||
    filters.family_type.length > 0 ||
    filters.pets.length > 0 ||
    filters.noise_level.length > 0 ||
    filters.duration.length > 0 ||
    filters.verified.length > 0 ||
    filters.smoking !== '' ||
    filters.has_reference !== '' ||
    filters.trust_min !== DEFAULT_FILTERS.trust_min ||
    filters.trust_max !== DEFAULT_FILTERS.trust_max

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            필터
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              초기화
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-5">
        {/* 정렬 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            정렬
          </Label>
          <div className="flex flex-col gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => update('sort', opt)}
                className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                  filters.sort === opt
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {SORT_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>

        {/* 신뢰점수 범위 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            신뢰점수 범위
          </Label>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{filters.trust_min}점</span>
              <span>{filters.trust_max >= 120 ? '120점 이상' : `${filters.trust_max}점`}</span>
            </div>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={filters.trust_min}
              onChange={(e) => update('trust_min', Number(e.target.value))}
              className="w-full accent-primary"
            />
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={filters.trust_max}
              onChange={(e) => update('trust_max', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* 지역 */}
        <CheckboxGroup
          label="선호 지역"
          options={REGIONS}
          selected={filters.region}
          onChange={(v) => update('region', v)}
        />

        {/* 가족 유형 */}
        <CheckboxGroup
          label="가족 유형"
          options={FAMILY_TYPES}
          selected={filters.family_type}
          onChange={(v) => update('family_type', v)}
        />

        {/* 반려동물 */}
        <CheckboxGroup
          label="반려동물"
          options={PETS}
          selected={filters.pets}
          onChange={(v) => update('pets', v)}
        />

        {/* 거주 소음 */}
        <CheckboxGroup
          label="거주 소음"
          options={NOISE_LEVELS}
          selected={filters.noise_level}
          onChange={(v) => update('noise_level', v)}
        />

        {/* 거주 기간 */}
        <CheckboxGroup
          label="희망 거주 기간"
          options={DURATIONS}
          selected={filters.duration}
          onChange={(v) => update('duration', v)}
        />

        {/* 인증 여부 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            인증
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {VERIFIED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = filters.verified.includes(opt.value)
                    ? filters.verified.filter((v) => v !== opt.value)
                    : [...filters.verified, opt.value]
                  update('verified', next)
                }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.verified.includes(opt.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 흡연 여부 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            흡연 여부
          </Label>
          <div className="flex gap-1.5">
            {[
              { value: '' as const, label: '전체' },
              { value: 'false' as const, label: '비흡연' },
              { value: 'true' as const, label: '흡연' },
            ].map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => update('smoking', opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.smoking === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 레퍼런스 보유 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            집주인 레퍼런스
          </Label>
          <div className="flex gap-1.5">
            {[
              { value: '' as const, label: '전체' },
              { value: 'true' as const, label: '레퍼런스 있음' },
            ].map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => update('has_reference', opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filters.has_reference === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
