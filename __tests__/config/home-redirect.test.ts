/**
 * `/home` → `/` 영구 리다이렉트 회귀 테스트 ([DOW-1183](/DOW/issues/DOW-1183)).
 *
 * 이 테스트가 증명하는 것과 증명하지 못하는 것을 분명히 적어 둔다.
 *
 * 증명한다: `next.config.js`의 `redirects()`가 `/home`을 `/`로, permanent로 넘긴다.
 * 즉 누가 이 항목을 지우거나 `permanent: false`로 바꾸면 CI에서 걸린다.
 *
 * 증명하지 못한다: 실제 서버가 308을 돌려주는지. 그건 Next가 이 설정을 해석한
 * 결과이므로 여기서는 확인할 수 없다. 실물 확인은 `e2e/onboarding.spec.ts`의
 * `/home` 리다이렉트 테스트가 맡는다. 다만 CI는 e2e를 돌리지 않으므로,
 * 설정이 조용히 사라지는 것만이라도 잡아 두는 쪽이 아무것도 없는 것보다 낫다.
 *
 * 그리고 사라진 화면을 되살리는 실수도 같이 막는다 — `app/home/`이 다시 생기면
 * 그 route가 리다이렉트를 이기고 렌더된다.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require('../../next.config.js') as {
  redirects?: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>
}

const repoRoot = path.resolve(__dirname, '../..')

describe('/home 정리', () => {
  it('`/home`은 `/`로 영구 리다이렉트된다', async () => {
    expect(typeof nextConfig.redirects).toBe('function')

    const redirects = await nextConfig.redirects!()
    const home = redirects.find((rule) => rule.source === '/home')

    expect(home).toBeDefined()
    expect(home!.destination).toBe('/')
    // 307이면 색인에 죽은 주소가 계속 남는다.
    expect(home!.permanent).toBe(true)
  })

  it('`app/home/` route는 존재하지 않는다', () => {
    // route가 있으면 redirects보다 route가 이긴다 — 리다이렉트가 조용히 무력화된다.
    expect(existsSync(path.join(repoRoot, 'app/home'))).toBe(false)
  })

  it('저장소 어디에도 `/home`으로 가는 내부 링크가 남아 있지 않다', async () => {
    const { spawnSync } = await import('node:child_process')

    // git이 추적하는 소스만 본다. node_modules/.next/문서는 판정 대상이 아니다.
    // git grep은 일치가 없으면 exit 1 + 빈 출력이다 — 그게 통과 조건이다.
    //
    // 이 파일 자신은 제외한다. 찾는 문자열을 인자로 들고 있으므로 스스로에게
    // 걸려 깨끗한 저장소에서도 실패한다. 제외 대상은 이 한 파일뿐이다.
    const result = spawnSync(
      'git',
      [
        'grep', '-l', '-F',
        '-e', 'href="/home"',
        '-e', "href='/home'",
        '--', '*.ts', '*.tsx',
        ':(exclude)__tests__/config/home-redirect.test.ts',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    )

    // exit 2 이상은 grep 자체가 실패한 것이다. 그걸 "일치 없음"으로 읽으면
    // 이 테스트는 아무것도 검사하지 않으면서 통과한다.
    expect(result.status, `git grep 실패: ${result.stderr}`).toBeLessThan(2)
    expect(result.stdout.trim()).toBe('')
  }, 15_000)
})
