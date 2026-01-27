'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, X } from 'lucide-react'

interface TenantFilterProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onReset: () => void
}

export interface FilterState {
  ageRange: string
  familyType: string
  minScore: string
  smoking: string
}

const ageRanges = [
  { value: '', label: '전체' },
  { value: '20대초반', label: '20대 초반' },
  { value: '20대후반', label: '20대 후반' },
  { value: '30대', label: '30대' },
  { value: '40대이상', label: '40대 이상' },
]

const familyTypes = [
  { value: '', label: '전체' },
  { value: '1인', label: '1인 가구' },
  { value: '커플', label: '커플' },
  { value: '가족', label: '가족' },
]

const scoreOptions = [
  { value: '', label: '전체' },
  { value: '80', label: '80점 이상' },
  { value: '50', label: '50점 이상' },
  { value: '20', label: '20점 이상' },
]

const smokingOptions = [
  { value: '', label: '전체' },
  { value: 'false', label: '비흡연' },
  { value: 'true', label: '흡연' },
]

export function TenantFilter({ filters, onChange, onReset }: TenantFilterProps) {
  const handleChange = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            필터
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="h-4 w-4 mr-1" />
              초기화
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">연령대</Label>
            <Select
              value={filters.ageRange}
              onValueChange={(value) => handleChange('ageRange', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                {ageRanges.map((option) => (
                  <SelectItem key={option.value} value={option.value || 'all'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">가구 유형</Label>
            <Select
              value={filters.familyType}
              onValueChange={(value) => handleChange('familyType', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                {familyTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value || 'all'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">신뢰점수</Label>
            <Select
              value={filters.minScore}
              onValueChange={(value) => handleChange('minScore', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                {scoreOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value || 'all'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">흡연 여부</Label>
            <Select
              value={filters.smoking}
              onValueChange={(value) => handleChange('smoking', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                {smokingOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value || 'all'}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
