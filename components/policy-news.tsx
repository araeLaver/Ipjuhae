import { fetchPolicyNews } from '@/lib/policy-news'

/**
 * 정책 소식.
 *
 * 가져올 게 없으면 **아무것도 그리지 않는다.** 빈 상자나 "곧 제공됩니다"를
 * 남기지 않는다. 없는 걸 있는 척하는 화면이 제일 나쁘다.
 *
 * 출처표시는 지워도 되는 장식이 아니다. 공공저작물 제1유형의 이용 조건이다.
 */
export async function PolicyNews() {
  const items = await fetchPolicyNews(5)
  if (items.length === 0) return null

  return (
    <section className="border-t">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <header className="mb-6">
          <h2 className="text-2xl font-bold">최근 정책 소식</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            전세와 임대차에 관련된 정부 발표를 모았습니다.
          </p>
        </header>

        <ul className="divide-y rounded-xl border">
          {items.map((n) => (
            <li key={n.url}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 transition-colors hover:bg-muted/40"
              >
                <p className="text-sm font-semibold leading-snug">{n.title}</p>
                {n.ministry ? (
                  <p className="mt-1 text-xs font-medium text-primary">{n.ministry}</p>
                ) : null}
                {n.summary ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {n.summary}
                  </p>
                ) : null}
                {n.approvedAt ? (
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">{n.approvedAt}</p>
                ) : null}
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          출처: 대한민국 정책브리핑 (www.korea.kr)
        </p>
      </div>
    </section>
  )
}
