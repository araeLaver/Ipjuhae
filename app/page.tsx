import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { getHomeContent, excerpt } from '@/lib/home-content'
import { TesterBanner } from '@/components/tester-banner'
import { POLICIES } from '@/lib/policies'
import { PolicyNews } from '@/components/policy-news'
import { HOME_TITLE } from '@/lib/site-metadata'

/**
 * 첫 화면.
 *
 * 전에는 커뮤니티 게시판을 그대로 띄웠다. 글쓴이가 운영자 혼자인 게시판은
 * 처음 온 사람에게 빈 방으로 보인다. 그래서 순서를 바꿨다.
 *
 * 1. 무엇을 해주는 곳인지 한 줄
 * 2. 바로 써볼 수 있는 도구 (/check)
 * 3. 이미 써둔 글 18편을 연재 단위로 펼쳐 보여준다 — 여기가 실물이다
 * 4. 제도 — 기준 하나를 몰라서 보증금 구간을 잘못 잡는 일이 실제로 일어난다
 * 5. 사람들이 올린 질문
 * 6. 앱과 테스터
 *
 * 글 목록은 서버에서 읽는다. 클라이언트 fetch로 그리면 검색엔진에는 빈 화면이
 * 색인된다. 글 하나하나가 유입 경로인데 그러면 아무 의미가 없다.
 */
/**
 * 요청마다 그린다.
 *
 * revalidate로 미리 만들어 두게 했더니 **빌드 시점에는 DB가 없어서** 빈 화면이
 * 그대로 굳었다. 배포 후에도 "글을 불러오지 못했습니다"가 계속 떴다.
 * 첫 방문자가 빈 홈을 보는 건 캐시로 아끼는 것보다 비싸다.
 *
 * 매달림 대비는 getHomeContent 쪽 시간 제한이 맡는다.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // 루트 레이아웃의 title.template은 자식 세그먼트에만 붙는다. `/`는 같은
  // 세그먼트라 적용되지 않으므로 브랜드를 직접 적는다.
  // 문구는 e2e와 공유한다 — lib/site-metadata.ts 주석 참고.
  title: HOME_TITLE,
  description:
    '전세 계약 전에 보증금이 안전한지 계산해 보고, 등기부에서 무엇을 봐야 하는지 확인하세요. 가입 없이 바로 쓸 수 있습니다.',
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const { series, questions, guideCount } = await getHomeContent()

  return (
    <>
      <Header />

      <main className="bg-background">
        {/* 1. 무엇을 하는 곳인가 */}
        <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
            <h1 className="text-balance text-3xl font-bold leading-tight sm:text-4xl">
              계약서에 도장 찍기 전에,
              <br />
              보증금부터 확인하세요
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              등기부와 시세에서 읽은 숫자를 넣으면 보증금이 안전한지 계산해 드립니다. 집이
              경매로 넘어갔을 때 얼마가 남는지까지 보여드립니다. 가입하지 않으셔도 됩니다.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/check"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                보증금 점검하기
              </Link>
              <Link
                href="#guides"
                className="inline-flex items-center justify-center rounded-lg border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/50"
              >
                등기부 읽는 법 보기
              </Link>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              시세를 저희가 추정하지 않습니다. 직접 확인하신 숫자로만 계산하고, 그 숫자는
              저장하지 않습니다.
            </p>
          </div>
        </section>

        {/* 2. 읽을 것 */}
        <section id="guides" className="mx-auto max-w-3xl scroll-mt-4 px-4 py-14">
          <header className="mb-8">
            <h2 className="text-2xl font-bold">입주해가 정리한 것</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {guideCount > 0
                ? `계약 전에 확인할 것을 순서대로 ${guideCount}편으로 정리했습니다.`
                : '계약 전에 확인할 것을 순서대로 정리하고 있습니다.'}
            </p>
          </header>

          {series.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              글을 불러오지 못했습니다. 잠시 후 다시 열어주세요.
            </p>
          ) : (
            <div className="space-y-12">
              {series.map((s) => (
                <div key={s.key}>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {s.lead}
                    </p>
                  </div>

                  <ol className="divide-y rounded-xl border">
                    {s.posts.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/community/${p.id}`}
                          className="flex gap-4 p-4 transition-colors hover:bg-muted/40"
                        >
                          <span className="mt-0.5 shrink-0 text-sm font-bold tabular-nums text-primary">
                            {p.episode}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-snug">
                              {p.subject}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              {excerpt(p.body)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. 제도 */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <header className="mb-6">
              <h2 className="text-2xl font-bold">알아두면 보증금을 지키는 제도</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                기준 하나를 몰라서 보증금 구간을 잘못 잡는 일이 실제로 일어납니다. 확인한 것만
                적고 출처와 확인일을 함께 싣습니다.
              </p>
            </header>

            <ul className="grid gap-3 sm:grid-cols-2">
              {POLICIES.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/policy#${p.slug}`}
                    className="block h-full rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40"
                  >
                    <span className="block text-sm font-bold">{p.title}</span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                      {p.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/policy"
              className="mt-5 inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
            >
              제도 전체 보기
            </Link>
          </div>
        </section>

        {/* 3-2. 정책 소식. 인증키가 없으면 통째로 사라진다 */}
        <PolicyNews />

        {/* 4. 사람들이 올린 것 */}
        <section className="border-t">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <header className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">계약 전에 물어보는 곳</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  임차인, 임대인, 공인중개사가 한 게시판에서 이야기합니다. 가입하지 않아도
                  읽고 쓸 수 있습니다.
                </p>
              </div>
            </header>

            {questions.length === 0 ? (
              <div className="rounded-xl border bg-background p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  아직 올라온 질문이 없습니다. 처음 물어보시는 분이 되어주세요.
                </p>
                <Link
                  href="/community"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  질문 남기기
                </Link>
              </div>
            ) : (
              <>
                <ul className="divide-y rounded-xl border bg-background">
                  {questions.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/community/${q.id}`}
                        className="block p-4 transition-colors hover:bg-muted/40"
                      >
                        <p className="text-sm font-semibold leading-snug">{q.title}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          댓글 {q.comment_count}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/community"
                  className="mt-5 inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
                >
                  커뮤니티 전체 보기
                </Link>
              </>
            )}
          </div>
        </section>

        {/* 5. 앱과 테스터 */}
        <section className="mx-auto max-w-3xl px-4 py-14">
          <TesterBanner />
        </section>

        <footer className="border-t">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Link href="/about" className="hover:text-foreground">
                입주해 소개
              </Link>
              <Link href="/check" className="hover:text-foreground">
                보증금 점검
              </Link>
              <Link href="/policy" className="hover:text-foreground">
                전세 제도
              </Link>
              <Link href="/community" className="hover:text-foreground">
                커뮤니티
              </Link>
              {/*
                `/home`이 사라지면서 `/properties`로 들어가는 유일한 동선도 같이
                끊겼다. "헤더 로고 → /home → 매물 찾기"가 전부였고, 헤더 역할별
                메뉴에는 임차인용 매물 탐색이 없다(`components/layout/header.tsx`).
                링크가 0개인 것과 쓰는 사람이 0명인 것은 다르므로, 위 로그인과
                같은 자리에 돌아갈 길만 남긴다. 홈의 읽는 순서는 건드리지 않는다.
              */}
              <Link href="/properties" className="hover:text-foreground">
                매물 찾기
              </Link>
              <Link href="/install" className="hover:text-foreground">
                앱으로 쓰기
              </Link>
              {/*
                `/home`을 지우면서 이 링크를 넣었다. 회원가입·로그인으로 들어가는
                유일한 클릭 동선이 "헤더 로고 → /home → 임대인 가입"이었는데,
                로고 목적지가 `/`로 바뀌면 그 동선이 통째로 끊긴다.

                헤더는 읽는 사람에게 로그인·회원가입을 들이밀지 않기로 해 두었다
                (`components/layout/header.tsx`). 그 결정은 그대로 두고, 이미
                계정이 있는 사람이 돌아올 길만 조용한 자리에 남긴다.
                `/signup`은 `/login` 안에서 이어진다.
              */}
              <Link href="/login" className="hover:text-foreground">
                로그인
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                이용약관
              </Link>
            </nav>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              입주해는 계약 판단을 대신해 드리지 않습니다. 계산은 넣으신 숫자만 가지고 하는
              것이며, 등기부에 적히지 않는 위험도 있습니다. 계약 전에는 등기부를 직접 떼어
              확인하세요.
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
