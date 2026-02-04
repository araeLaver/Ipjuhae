'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Plus, X, Building } from 'lucide-react'
import { Property, PropertyType, PropertyStatus } from '@/types/database'
import { toast } from 'sonner'

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: '아파트' },
  { value: 'villa', label: '빌라' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'oneroom', label: '원룸' },
  { value: 'house', label: '주택' },
  { value: 'other', label: '기타' },
]

const DEFAULT_OPTIONS = [
  '에어컨', '세탁기', '냉장고', '가스레인지', '인덕션',
  '전자레인지', 'TV', '침대', '옷장', '책상',
  '신발장', '빌트인', '베란다', '주차가능',
]

interface PropertyFormProps {
  property?: Property
  onSuccess?: (property: Property) => void
}

export function PropertyForm({ property, onSuccess }: PropertyFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: property?.title || '',
    description: property?.description || '',
    address: property?.address || '',
    addressDetail: property?.address_detail || '',
    region: property?.region || '',
    deposit: property?.deposit?.toString() || '',
    monthlyRent: property?.monthly_rent?.toString() || '',
    maintenanceFee: property?.maintenance_fee?.toString() || '0',
    propertyType: (property?.property_type || 'oneroom') as PropertyType,
    roomCount: property?.room_count?.toString() || '1',
    bathroomCount: property?.bathroom_count?.toString() || '1',
    floor: property?.floor?.toString() || '',
    totalFloor: property?.total_floor?.toString() || '',
    areaSqm: property?.area_sqm?.toString() || '',
    availableFrom: property?.available_from || '',
    status: (property?.status || 'available') as PropertyStatus,
  })
  const [options, setOptions] = useState<string[]>(property?.options || [])
  const [newOption, setNewOption] = useState('')

  const handleAddOption = (option: string) => {
    if (option.trim() && !options.includes(option.trim())) {
      setOptions([...options, option.trim()])
    }
    setNewOption('')
  }

  const handleRemoveOption = (option: string) => {
    setOptions(options.filter(o => o !== option))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        address: formData.address,
        addressDetail: formData.addressDetail || undefined,
        region: formData.region || undefined,
        deposit: parseInt(formData.deposit) || 0,
        monthlyRent: parseInt(formData.monthlyRent) || 0,
        maintenanceFee: parseInt(formData.maintenanceFee) || 0,
        propertyType: formData.propertyType,
        roomCount: parseInt(formData.roomCount) || 1,
        bathroomCount: parseInt(formData.bathroomCount) || 1,
        floor: formData.floor ? parseInt(formData.floor) : undefined,
        totalFloor: formData.totalFloor ? parseInt(formData.totalFloor) : undefined,
        areaSqm: formData.areaSqm ? parseFloat(formData.areaSqm) : undefined,
        options,
        availableFrom: formData.availableFrom || undefined,
        status: formData.status,
      }

      const url = property
        ? `/api/landlord/properties/${property.id}`
        : '/api/landlord/properties'

      const response = await fetch(url, {
        method: property ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success(property ? '매물이 수정되었습니다' : '매물이 등록되었습니다')

      if (onSuccess) {
        onSuccess(data.property)
      } else {
        router.push(`/landlord/properties/${data.property.id}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">매물명 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 신축 풀옵션 원룸"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propertyType">매물 유형 *</Label>
              <Select
                value={formData.propertyType}
                onValueChange={(value: PropertyType) => setFormData({ ...formData, propertyType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {property && (
              <div className="space-y-2">
                <Label htmlFor="status">상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: PropertyStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">공실</SelectItem>
                    <SelectItem value="reserved">예약중</SelectItem>
                    <SelectItem value="rented">계약완료</SelectItem>
                    <SelectItem value="hidden">비공개</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">상세 설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="매물에 대한 상세한 설명을 입력하세요"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* 위치 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">위치</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">주소 *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="서울시 강남구 역삼동 123-45"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressDetail">상세 주소</Label>
              <Input
                id="addressDetail"
                value={formData.addressDetail}
                onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                placeholder="101호"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">지역</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="서울시 강남구"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 가격 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">가격 (원)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit">보증금 *</Label>
              <Input
                id="deposit"
                type="number"
                min="0"
                step="10000"
                value={formData.deposit}
                onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                placeholder="50000000"
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.deposit && parseInt(formData.deposit) > 0
                  ? `${(parseInt(formData.deposit) / 10000).toLocaleString()}만원`
                  : ''}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyRent">월세 *</Label>
              <Input
                id="monthlyRent"
                type="number"
                min="0"
                step="10000"
                value={formData.monthlyRent}
                onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                placeholder="500000"
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.monthlyRent && parseInt(formData.monthlyRent) > 0
                  ? `${(parseInt(formData.monthlyRent) / 10000).toLocaleString()}만원`
                  : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenanceFee">관리비</Label>
            <Input
              id="maintenanceFee"
              type="number"
              min="0"
              step="10000"
              value={formData.maintenanceFee}
              onChange={(e) => setFormData({ ...formData, maintenanceFee: e.target.value })}
              placeholder="50000"
            />
          </div>
        </CardContent>
      </Card>

      {/* 매물 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">매물 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roomCount">방</Label>
              <Input
                id="roomCount"
                type="number"
                min="1"
                value={formData.roomCount}
                onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathroomCount">화장실</Label>
              <Input
                id="bathroomCount"
                type="number"
                min="1"
                value={formData.bathroomCount}
                onChange={(e) => setFormData({ ...formData, bathroomCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaSqm">면적 (㎡)</Label>
              <Input
                id="areaSqm"
                type="number"
                min="0"
                step="0.01"
                value={formData.areaSqm}
                onChange={(e) => setFormData({ ...formData, areaSqm: e.target.value })}
                placeholder="33"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="floor">층수</Label>
              <Input
                id="floor"
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalFloor">총 층수</Label>
              <Input
                id="totalFloor"
                type="number"
                min="1"
                value={formData.totalFloor}
                onChange={(e) => setFormData({ ...formData, totalFloor: e.target.value })}
                placeholder="15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availableFrom">입주 가능일</Label>
            <Input
              id="availableFrom"
              type="date"
              value={formData.availableFrom}
              onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 옵션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">옵션</CardTitle>
          <CardDescription>포함된 옵션을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DEFAULT_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (options.includes(option)) {
                    handleRemoveOption(option)
                  } else {
                    handleAddOption(option)
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  options.includes(option)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="직접 입력"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddOption(newOption)
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddOption(newOption)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {options.filter(o => !DEFAULT_OPTIONS.includes(o)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.filter(o => !DEFAULT_OPTIONS.includes(o)).map(option => (
                <span
                  key={option}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm"
                >
                  {option}
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(option)}
                    className="hover:opacity-80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            {property ? '수정하기' : '등록하기'}
          </>
        )}
      </Button>
    </form>
  )
}
