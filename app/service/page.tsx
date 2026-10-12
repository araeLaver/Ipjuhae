import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { billingReadiness } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/plans'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: '이용 서비스와 요금',
  description:
    '가입 없는 계약 준비 도구와 집주인 매물 관리 플랜, 이용 문의를 확인하세요.',
  alternates: { canonical: '/service' },
}
export default function ServicePage() {
  const billing = billingReadiness()
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold">
            집을 고르고 계약을 준비하는 동안
          </h1>
          <p className="mt-3 text-muted-foreground">
            입주해에서 후보별 보증금 부담과 아직 확인하지 못한 일을 정리하세요.
          </p>
        </div>
        <section className="rounded-xl border p-6 space-y-4">
          <h2 className="text-xl font-bold">개인 계약 준비 도구 · 무료</h2>
          <ul className="space-y-2">
            <li>가입 없이 입력한 숫자로 보증금 부담 점검</li>
            <li>후보 5개 저장·비교와 계약 전 확인 기록</li>
            <li>준비 기록 내려받기와 다른 브라우저에서 백업 복원</li>
            <li>공식 정책소식과 계약 전 질문 게시판</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            직접 확인한 숫자와 본인 기록을 사용합니다. 자동 권리 분석이나 계약
            안전 보증을 제공하지 않습니다.
          </p>
          <Link
            href="/check?from=service"
            className="inline-block rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground"
          >
            무료로 계약 준비 시작
          </Link>
        </section>
        <section className="rounded-xl border p-6 space-y-4">
          <h2 className="text-xl font-bold">집주인 매물 관리</h2>
          <p>등록할 매물 수와 추천 노출 수를 늘리는 월 이용 플랜입니다.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(PLAN_LIMITS).map(([key, plan]) => (
              <div key={key} className="rounded-lg border p-4">
                <h3 className="font-bold">{plan.label}</h3>
                <p>
                  {plan.price
                    ? `${plan.price.toLocaleString('ko-KR')}원/월`
                    : '무료'}
                </p>
                <p className="mt-2 text-sm">
                  매물 {plan.maxProperties}개 · 추천 노출 {plan.maxFeatured}개
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm">
            {billing.ready
              ? '로그인 후 현재 이용량과 결제 가능 여부를 확인할 수 있습니다.'
              : '현재 유료 결제는 준비 중입니다. 무료 도구는 바로 이용하고, 사업자 도입은 아래 고객 문의로 알려주세요.'}{' '}
            추천 노출은 문의나 계약 성사를 보장하지 않습니다.
          </p>
          {billing.ready && (
            <Link
              className="inline-block font-bold text-primary underline"
              href="/landlord/subscription"
            >
              집주인 이용 플랜 확인
            </Link>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-bold">사업자 도입·이용 문의</h2>
          <p>
            이용 목적과 필요한 범위를 알려주세요. 지원 범위·가격·제공 조건을
            확인한 뒤 진행합니다.
          </p>
          <a
            className="font-semibold text-primary underline"
            href="mailto:ipjuhae.official@gmail.com?subject=%EC%9E%85%EC%A3%BC%ED%95%B4%20%EC%84%9C%EB%B9%84%EC%8A%A4%20%EB%8F%84%EC%9E%85%20%EB%AC%B8%EC%9D%98"
          >
            ipjuhae.official@gmail.com
          </a>
          <p className="text-sm text-muted-foreground">
            문의에 주소·연락처 외 개인정보나 계약서 원본을 포함하지 마세요.
          </p>
        </section>
        <nav aria-label="이용 안내" className="flex gap-4 text-sm">
          <Link className="underline" href="/terms">
            이용약관
          </Link>
          <Link className="underline" href="/privacy">
            개인정보처리방침
          </Link>
          <Link className="underline" href="/community#ask">
            질문 남기기
          </Link>
        </nav>
      </main>
    </>
  )
}
