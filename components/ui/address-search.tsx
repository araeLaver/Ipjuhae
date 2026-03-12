'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Search, X } from 'lucide-react'

interface AddressData {
  address: string       // 도로명 주소
  jibunAddress: string  // 지번 주소
  zonecode: string      // 우편번호
  sido: string          // 시/도
  sigungu: string       // 시/군/구
  bname: string         // 동/읍/면
}

interface AddressSearchProps {
  value: string
  onChange: (address: string, region?: string) => void
  placeholder?: string
  required?: boolean
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daum: any
  }
}

// 지역명 → region 코드 매핑
function extractRegion(sido: string, sigungu: string): string {
  const regionMap: Record<string, string> = {
    '서울': 'seoul',
    '경기': 'gyeonggi',
    '인천': 'incheon',
    '부산': 'busan',
    '대구': 'daegu',
    '광주': 'gwangju',
    '대전': 'daejeon',
    '울산': 'ulsan',
    '세종': 'sejong',
    '강원': 'gangwon',
    '충북': 'chungbuk',
    '충남': 'chungnam',
    '전북': 'jeonbuk',
    '전남': 'jeonnam',
    '경북': 'gyeongbuk',
    '경남': 'gyeongnam',
    '제주': 'jeju',
  }
  for (const [key, value] of Object.entries(regionMap)) {
    if (sido.includes(key) || sigungu.includes(key)) {
      return value
    }
  }
  return ''
}

export function AddressSearch({
  value,
  onChange,
  placeholder = '주소를 검색하세요',
  required,
}: AddressSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  // Daum Postcode 스크립트 로드
  useEffect(() => {
    if (window.daum?.Postcode) {
      setIsScriptLoaded(true)
      return
    }
    if (scriptRef.current) return

    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.onload = () => setIsScriptLoaded(true)
    document.head.appendChild(script)
    scriptRef.current = script
  }, [])

  const openPostcode = useCallback(() => {
    if (!isScriptLoaded || !window.daum?.Postcode) return

    setIsOpen(true)

    // 약간의 딜레이 후 열어서 DOM이 준비되도록
    setTimeout(() => {
      new window.daum.Postcode({
        oncomplete: (data: AddressData) => {
          const addr = data.address || data.jibunAddress
          const region = extractRegion(data.sido, data.sigungu)
          onChange(addr, region || undefined)
          setIsOpen(false)
        },
        onclose: () => setIsOpen(false),
        width: '100%',
        height: '100%',
        maxSuggestItems: 5,
        theme: {
          bgColor: '#ffffff',
          searchBgColor: '#f3f4f6',
          contentBgColor: '#ffffff',
          pageBgColor: '#f9fafb',
          textColor: '#111827',
          queryTextColor: '#111827',
          postcodeTextColor: '#6b7280',
          emphTextColor: '#2563eb',
          outlineColor: '#e5e7eb',
        },
      }).embed(containerRef.current, { autoClose: true })
    }, 50)
  }, [isScriptLoaded, onChange])

  const handleClear = () => {
    onChange('', undefined)
  }

  return (
    <div className="space-y-2">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={value}
            readOnly
            placeholder={placeholder}
            required={required}
            className="pl-9 pr-8 cursor-pointer bg-background"
            onClick={openPostcode}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={openPostcode}
          disabled={!isScriptLoaded}
          title="주소 검색"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Daum Postcode 팝업 컨테이너 */}
      {isOpen && (
        <div className="relative border rounded-lg overflow-hidden shadow-lg bg-background z-50">
          <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
            <span className="text-sm font-medium">주소 검색</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={containerRef}
            style={{ width: '100%', height: '400px' }}
          />
        </div>
      )}
    </div>
  )
}
