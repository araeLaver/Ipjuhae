import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { POLICIES, formatCheckedAt } from '@/lib/policies'

/**
 * 제도 정리.
 *
 * 전세 계약에서 사람을 살리는 건 결국 제도다. 최우선변제 기준 하나를 몰라서
 * 보증금 구간을 잘못 잡는 일이 실제로 일어난다.
 *
 * 정부 RSS와 공개 API를 붙여 자동으로 채우는 길을 먼저 찾아봤지만,
 * korea.kr·국토부·HUG 모두 서버 요청을 막거나 인증키를 요구했다. 그래서
 * 확인한 것을 손으로 정리하고 **출처와 확인일을 반드시 함께 싣는다.**
 * 자동으로 긁어온 척하는 것보다 언제 확인한 것인지 밝히는 쪽이 정직하다.
 */
export const metadata: Metadata = {
  title: '전세 제도 정리',
  description:
    '소액임차인 최우선변제, 전입신고와 확정일자, 전세보증금반환보증, 임차권등기명령. 계약 전에 알아야 할 제도를 출처와 함께 정리했습니다.',
  alternates: { canonical: '/policy' },
  openGraph: {
    title: '전세 제도 정리 | 입주해',
    description: '계약 전에 알아야 할 제도를 출처와 확인일과 함께 정리했습니다.',
    url: 'https://www.ipjuhae.com/policy',
    type: 'website',
  },
}

export default function PolicyPage() {
  return (
    <>
      <Header />

      <main className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <header className="space-y-4">
            <h1 className="text-balance text-3xl font-bold leading-tight">전세 제도 정리</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              계약에서 사람을 지키는 건 결국 제도입니다. 기준 하나를 몰라서 보증금 구간을 잘못
              잡는 일이 실제로 일어납니다. 확인한 것만 적고, 어디서 확인했는지와 언제 확인했는지를
              함께 싣습니다.
            </p>
            <p className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
              제도는 바뀝니다. 각 항목의 확인일을 보시고, 계약 직전에는 출처 링크에서 현재 기준을
              다시 확인하세요. 저희가 확인하지 못한 수치는 적지 않고 공식 창구로 안내합니다.
            </p>
          </header>

          <nav className="mt-8 flex flex-wrap gap-2">
            {POLICIES.map((p) => (
              <a
                key={p.slug}
                href={`#${p.slug}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/50"
              >
                {p.title}
              </a>
            ))}
          </nav>

          <div className="mt-12 space-y-14">
            {POLICIES.map((policy) => (
              <article key={policy.slug} id={policy.slug} className="scroll-mt-4">
                <h2 className="text-xl font-bold leading-snug">{policy.title}</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-primary">
                  {policy.summary}
                </p>

                <p className="mt-4 text-xs text-muted-foreground">
                  <span className="font-semibold">해당되는 분</span> {policy.who}
                </p>

                <div className="mt-4 space-y-3">
                  {policy.body.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>

                {policy.table ? (
                  <figure className="mt-5">
                    {policy.table.caption ? (
                      <figcaption className="mb-2 text-xs font-semibold text-muted-foreground">
                        {policy.table.caption}
                      </figcaption>
                    ) : null}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[32rem] text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            {policy.table.head.map((h) => (
                              <th
                                key={h}
                                scope="col"
                                className="px-4 py-2.5 text-left text-xs font-semibold"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {policy.table.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className={`px-4 py-2.5 ${j > 0 ? 'tabular-nums font-medium' : ''}`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </figure>
                ) : null}

                {policy.caution ? (
                  <p className="mt-5 rounded-lg border-l-2 border-primary bg-primary/5 px-4 py-3 text-sm leading-relaxed">
                    {policy.caution}
                  </p>
                ) : null}

                <footer className="mt-5 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">출처</p>
                  <ul className="mt-2 space-y-1.5">
                    {policy.sources.map((s) => (
                      <li key={s.url}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-4"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatCheckedAt(policy.checkedAt)} 확인
                  </p>
                </footer>
              </article>
            ))}
          </div>

          <section className="mt-16 rounded-xl border bg-muted/30 p-6">
            <h2 className="text-base font-bold">내 계약은 어느 쪽인가</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              제도를 읽어도 내 보증금이 안전한지는 숫자를 넣어봐야 압니다. 등기부와 시세에서 읽은
              값을 넣으면 계산해 드립니다.
            </p>
            <Link
              href="/check"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              보증금 점검하기
            </Link>
          </section>

          <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
            이 페이지는 법률 자문이 아닙니다. 개별 사안은 대한법률구조공단이나 변호사에게
            상담하세요. 내용에 잘못된 곳이 있으면{' '}
            <Link href="/community" className="text-primary underline underline-offset-4">
              커뮤니티
            </Link>
            에 알려주시면 고치겠습니다.
          </p>
        </div>
      </main>
    </>
  )
}
