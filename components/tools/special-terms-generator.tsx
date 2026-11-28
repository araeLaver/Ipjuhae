'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildSpecialTerms, type SpecialTermsInput } from '@/lib/special-terms'
import { RegistryAlertCta } from '@/components/tools/registry-alert-cta'

const TOGGLE_ITEMS: Array<{ key: keyof SpecialTermsInput; label: string; hint: string }> = [
  {
    key: 'hasMortgage',
    label: '등기부 을구에 근저당(대출)이 있어요',
    hint: '잔금 동시 근저당권 말소·접수증 교부 특약 추가',
  },
  {
    key: 'hasPriorTenants',
    label: '다가구 주택(선순위 세입자 있음)이에요',
    hint: '선순위 임차인 보증금 총액·확정일자 현황 교부 특약 추가',
  },
  {
    key: 'needsInsurance',
    label: '전세보증보험(HUG·HF·SGI)에 가입할 예정이에요',
    hint: '보증보험 가입 협조 및 미승인 시 계약금 반환 특약 추가',
  },
  {
    key: 'needsJeonseLoan',
    label: '전세자금대출을 받을 예정이에요',
    hint: '전세대출 미승인 시 계약금 전액 반환 특약 추가',
  },
  {
    key: 'needsRepairCheck',
    label: '입주 전 수선·원상복구 범위를 분명히 하고 싶어요',
    hint: '노후 설비 임대인 부담 및 통상 마모 원상복구 제외 특약 추가',
  },
  {
    key: 'hasPet',
    label: '반려동물과 함께 거주해요',
    hint: '반려동물 허용 및 명백한 파손 범위 실비 원상복구 특약 추가',
  },
]

export function SpecialTermsGenerator() {
  const [options, setOptions] = useState<SpecialTermsInput>({
    hasMortgage: false,
    hasPriorTenants: false,
    needsJeonseLoan: true,
    needsInsurance: true,
    hasPet: false,
    needsRepairCheck: true,
  })
  const [notice, setNotice] = useState('')

  const bundle = buildSpecialTerms(options)

  function toggle(key: keyof SpecialTermsInput) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }))
    setNotice('')
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${label}을(를) 복사했습니다.`)
    } catch {
      setNotice('브라우저에서 자동 복사를 지원하지 않습니다. 아래 텍스트를 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-3">
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          무료 · 가입 없음 · 10초 맞춤 생성
        </span>
        <h1 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">
          전월세 계약 필수 특약 생성기
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          내 집 조건을 체크하면 계약서에 바로 넣을 수 있는 맞춤 특약과 중개사·집주인에게 정중하게
          보내는 카톡 요청 문자를 만들어 드립니다.
        </p>
      </header>

      <Card className="space-y-3 p-5 sm:p-6">
        <h2 className="text-sm font-bold">1. 내 계약 조건 선택</h2>
        <div className="space-y-2.5">
          {TOGGLE_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={options[item.key]}
                onChange={() => toggle(item.key)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">
            2. 생성된 맞춤 특약 ({bundle.items.length}개)
          </h2>
          <Button
            type="button"
            size="sm"
            onClick={() => void copy(bundle.contractText, '계약서 특약 전체')}
          >
            계약서 특약 전체 복사
          </Button>
        </div>

        <ol className="space-y-3">
          {bundle.items.map((item, idx) => (
            <li key={item.id} className="space-y-1.5 rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {item.category}
                </span>
                <p className="text-sm font-bold">
                  {idx + 1}. {item.title}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{item.clause}</p>
              <p className="text-xs text-muted-foreground">왜 필요한가요? {item.why}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">3. 중개사·집주인에게 보내는 정중한 요청 문자</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copy(bundle.politeMessage, '요청 카톡 문자')}
          >
            카톡 요청 문자 복사
          </Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-sans text-xs leading-relaxed text-foreground">
          {bundle.politeMessage}
        </pre>
      </Card>

      {notice ? (
        <p role="status" className="text-center text-sm font-semibold text-primary">
          {notice}
        </p>
      ) : null}

      <RegistryAlertCta sourceTag="special_terms" />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/check"
          className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
        >
          등기부·보증금 안전 진단하러 가기
        </Link>
        <Link
          href="/tools/hug-check"
          className="rounded-md border px-4 py-2.5 font-semibold text-primary"
        >
          HUG 126% 보증보험 계산기
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        생성된 특약 문구는 계약 협의를 돕기 위한 참고 자료이며 법률 자문이 아닙니다. 실제 계약서
        작성 시 공인중개사 및 당사자 간 합의를 거쳐 확정하세요.
      </p>
    </div>
  )
}
