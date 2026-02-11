'use client'

import Link from 'next/link'

interface TermsConsentProps {
  termsAgreed: boolean
  privacyAgreed: boolean
  marketingAgreed: boolean
  onTermsChange: (v: boolean) => void
  onPrivacyChange: (v: boolean) => void
  onMarketingChange: (v: boolean) => void
}

export function TermsConsent({
  termsAgreed,
  privacyAgreed,
  marketingAgreed,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
}: TermsConsentProps) {
  const allAgreed = termsAgreed && privacyAgreed && marketingAgreed

  const handleAllChange = (checked: boolean) => {
    onTermsChange(checked)
    onPrivacyChange(checked)
    onMarketingChange(checked)
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
        <input
          type="checkbox"
          checked={allAgreed}
          onChange={(e) => handleAllChange(e.target.checked)}
          className="rounded border-input text-primary focus:ring-primary h-4 w-4"
        />
        전체 동의
      </label>

      <div className="border-t pt-2 space-y-2 pl-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <span>
            <span className="text-destructive">[필수]</span>{' '}
            <Link href="/terms" target="_blank" className="underline hover:text-primary">
              이용약관
            </Link>
            에 동의합니다
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(e) => onPrivacyChange(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <span>
            <span className="text-destructive">[필수]</span>{' '}
            <Link href="/privacy" target="_blank" className="underline hover:text-primary">
              개인정보처리방침
            </Link>
            에 동의합니다
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={marketingAgreed}
            onChange={(e) => onMarketingChange(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <span>
            <span className="text-muted-foreground">[선택]</span> 마케팅 정보 수신에 동의합니다
          </span>
        </label>
      </div>
    </div>
  )
}
