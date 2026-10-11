import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ShieldCheck,
  ListChecks,
  MessageCircle,
  BookOpen,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { getHomeContent } from '@/lib/home-content'
import { POLICIES } from '@/lib/policies'
import { PolicyNews } from '@/components/policy-news'
import { HOME_TITLE } from '@/lib/site-metadata'
import { HomeReturnLinks } from '@/components/home-return-links'
import { ShareCheck } from '@/components/share-check'

// Always read the current public content; a build-time DB failure must not freeze the home.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: HOME_TITLE,
  description:
    '가입 없이 보증금을 점검하고 후보 집을 비교하세요. 계약 전 확인할 일과 최신 주거 정책소식을 한곳에서 확인할 수 있습니다.',
  alternates: { canonical: '/' },
}

const actions = [
  {
    href: '/check?from=home',
    icon: ShieldCheck,
    title: '보증금 점검',
    description: '시세와 보증금을 넣고, 계약 전 확인할 일을 알아보세요.',
    label: '가입 없이 시작',
    number: '01',
  },
  {
    href: '/check#candidates',
    icon: ListChecks,
    title: '후보 집 비교',
    description: '점검한 집을 저장하고, 후보별로 남은 확인을 정리하세요.',
    label: '점검 화면에서 후보 저장',
    number: '02',
  },
  {
    href: '/community#ask',
    icon: MessageCircle,
    title: '계약 전 질문',
    description: '점검하다 막힌 부분이나 계약 전 궁금한 점을 물어보세요.',
    label: '질문 게시판으로',
    number: '03',
  },
]

export default async function HomePage() {
  const { status, series, questions, guideCount } = await getHomeContent()
  return (
    <>
      <Header />
      <main className="bg-background">
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="mx-auto max-w-5xl px-4 pb-7 pt-8 sm:pb-10 sm:pt-12">
            <div className="grid items-center gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-xs font-bold tracking-wide text-primary">
                  집을 고를 때부터 계약하기 전까지
                </p>
                <h1 className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
                  내 보증금부터 점검하세요
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                  집을 고를 때 보증금을 점검하고, 후보별로 확인할 일을
                  정리하세요. 가입 없이 시작하고 같은 브라우저에서 이어볼 수
                  있습니다.
                </p>
                <Link
                  href="/check?from=home"
                  className="mt-5 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  보증금 점검하기 (가입 없이){' '}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="mt-3 text-xs text-muted-foreground">
                  직접 확인한 숫자로 계산합니다. 결과는 계약 전 참고 정보입니다.
                </p>
              </div>
              <ol
                aria-label="보증금 점검 순서"
                className="hidden rounded-2xl border bg-background/80 p-5 lg:block"
              >
                <li className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    1
                  </span>
                  시세와 보증금 입력
                </li>
                <li className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    2
                  </span>
                  계산 결과 확인
                </li>
                <li className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    3
                  </span>
                  남은 확인과 다음 할 일 정리
                </li>
              </ol>
            </div>
            <nav
              aria-label="바로 시작하기"
              className="mt-6 grid gap-3 sm:grid-cols-3"
            >
              {actions.map((action) => (
                <Link
                  key={action.number}
                  href={action.href}
                  className="group flex items-start gap-3 rounded-xl border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 sm:flex-col"
                >
                  <action.icon
                    className="h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold">{action.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {action.description}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {action.label}{' '}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </nav>
            <HomeReturnLinks />
          </div>
        </section>

        <PolicyNews compact />

        <section
          id="guides"
          className="mx-auto max-w-5xl scroll-mt-24 px-4 py-8 sm:py-10"
        >
          <header className="mb-5 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-bold">계약 전 읽을 것</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {guideCount > 0
                  ? `등기부부터 임대인 확인까지, ${guideCount}편의 안내를 필요한 순서로 읽어보세요.`
                  : '등기부와 계약 전 확인할 일을 정리했습니다.'}
              </p>
            </div>
          </header>
          {series.length === 0 ? (
            <div className="rounded-xl border p-5 text-sm text-muted-foreground">
              안내 글을 불러오지 못했습니다.{' '}
              <Link href="/community" className="text-primary underline">
                게시판에서 확인하기
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {series.map((s) => (
                <article key={s.key} className="rounded-xl border p-5">
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {s.lead}
                  </p>
                  <ol className="mt-3 divide-y">
                    {s.posts.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/community/${p.id}`}
                          className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary"
                        >
                          <span className="text-xs font-bold tabular-nums text-primary">
                            {p.episode}
                          </span>
                          {p.subject}
                        </Link>
                      </li>
                    ))}
                  </ol>
                  {s.posts.length > 3 && (
                    <details className="mt-3 border-t pt-3">
                      <summary className="cursor-pointer py-2 text-sm font-semibold text-primary">
                        나머지 {s.posts.length - 3}편 펼쳐보기
                      </summary>
                      <ol className="mt-2 divide-y">
                        {s.posts.slice(3).map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/community/${p.id}`}
                              className="flex min-h-12 items-center gap-3 py-3 text-sm hover:text-primary"
                            >
                              <span className="text-xs font-bold text-primary">
                                {p.episode}
                              </span>
                              {p.subject}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="border-t bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">알아둘 전세 제도</h2>
              <Link
                href="/policy"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              >
                제도 전체 보기 →
              </Link>
            </header>
            <ul className="grid gap-3 sm:grid-cols-3">
              {POLICIES.slice(0, 3).map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/policy#${p.slug}`}
                    className="block h-full rounded-xl border bg-background p-5 hover:border-primary/50"
                  >
                    <h3 className="text-sm font-bold">{p.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {p.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">계약 전에 물어보는 곳</h2>
            <Link
              href="/community"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
            >
              게시판으로 이동 →
            </Link>
          </header>
          {status === 'error' ? (
            <p className="rounded-xl border p-5 text-sm text-muted-foreground">
              질문을 불러오지 못했습니다. 잠시 후 다시 열어주세요.
            </p>
          ) : questions.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">
                아직 올라온 질문이 없습니다. 계약 전에 궁금한 점을 남겨보세요.
              </p>
              <Link
                href="/community#ask"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                질문 남기기
              </Link>
            </div>
          ) : (
            <ul className="divide-y rounded-xl border">
              {questions.slice(0, 3).map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/community/${q.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 p-4 hover:bg-muted/40"
                  >
                    <span className="text-sm font-semibold">{q.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      댓글 {q.comment_count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:grid-cols-2">
            <ShareCheck />
            <div className="rounded-xl border p-5">
              <h2 className="text-base font-bold">다음 집을 볼 때도 이어서</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                저장한 후보의 확인 목록과 보관한 질문을 같은 브라우저에서
                이어보세요. 자주 쓴다면 휴대폰 홈 화면에 추가할 수 있습니다.
              </p>
              <Link
                href="/install"
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              >
                홈 화면에 추가하는 방법 →
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <nav
              aria-label="서비스 안내"
              className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-muted-foreground"
            >
              {[
                ['/about', '입주해 소개'],
                ['/check', '보증금 점검'],
                ['/policy/news', '정책소식'],
                ['/policy', '전세 제도'],
                ['/community', '커뮤니티'],
                ['/install', '모바일 이용'],
                ['/login', '로그인'],
                ['/privacy', '개인정보처리방침'],
                ['/terms', '이용약관'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex min-h-11 items-center hover:text-foreground"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              입주해는 계약 판단을 대신하지 않습니다. 직접 확인한 숫자로
              계산하며, 등기부에 적히지 않는 위험도 있습니다. 계약 전에는 최신
              등기부와 공식 기준을 확인하세요.
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
