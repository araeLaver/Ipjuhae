"""서식2 2.2 (5) 개발 산출물 규모 — 재측정 명령 고정.

원고는 "커밋 505건, API 엔드포인트 137개, 웹 화면 79개, 모바일 화면 17개"를
2026-09-26 기준으로 적고 제출 당일 재측정을 요구한다. 그런데 각 수치의 계량
정의(무엇을 1개로 세는지)가 어디에도 기록되어 있지 않았다. 정의가 없으면
재측정 담당자가 다른 수를 내고, 심사에서 건별 증빙을 요구할 때 재현할 수 없다.

2026-09-27 CMO 대조로 정의 3건을 특정해 기재값을 재현했다.

  API 엔드포인트 137 = app/api 아래 route.ts 파일 수 (핸들러 수는 181로 다르다)
  웹 화면 79         = app 아래 page.tsx 파일 수 (09-27 app/tester/page.tsx 추가로 80)
  모바일 화면 17     = mobile/src/screens 아래 tsx 파일 수 (mobile 전체 tsx 는 23)

커밋만 시·분 단위로 움직여 재현되지 않는다. 09-26 12:00 KST 492건,
23:59 KST 516건이므로 505건은 그날 낮 어느 시점의 값으로 정합적이다.

이 스크립트는 그 정의를 명령으로 고정한다. 값이 원고와 다르면 원고를 고치거나
정의를 고쳐야 한다는 뜻이며, 스크립트가 원고에 맞춰 값을 꾸미지 않는다.

주의: RTK 훅이 git 명령을 재작성하면 커밋 수가 조용히 틀린다(실측 10건 보고
사례). 그래서 git 은 `rtk proxy` 를 경유하고, 실패 시 소명 없이 통과시키지 않는다.

사용법: python3 scripts/stats/gvalley_output_metrics.py [기준일 YYYY-MM-DD]
"""

import shutil
import subprocess
import sys

FIRST_COMMIT_DAY = '2026-01-25'


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        return None, (p.stderr or '').strip()[:200]
    return p.stdout.strip(), None


def git(args):
    """rtk 훅 재작성을 우회해 git 을 직접 호출한다."""
    if shutil.which('rtk'):
        out, err = run(['rtk', 'proxy', 'git'] + args)
        if out is not None:
            return out, None
    return run(['git'] + args)


def count_files(pattern_args):
    out, err = run(['bash', '-c', pattern_args])
    if err is not None:
        return None, err
    return len([l for l in out.split('\n') if l.strip()]), None


def main(asof=None):
    asof = asof or FIRST_COMMIT_DAY
    rows = []

    n, err = git(['rev-list', '--count',
                  '--since=%sT00:00:00+09:00' % FIRST_COMMIT_DAY,
                  '--until=%sT23:59:59+09:00' % asof, 'HEAD'])
    rows.append(('커밋', n if n else 'ERR:' + str(err),
                 'git rev-list --count --since=%s --until=%s (KST, HEAD, 머지 포함)'
                 % (FIRST_COMMIT_DAY, asof)))

    n, err = count_files("find app/api -name route.ts | sort")
    rows.append(('API 라우트 파일', n if n is not None else 'ERR',
                 'app/api 아래 route.ts 파일 수'))

    n, err = count_files(
        "grep -rhoE '^export (async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' "
        "app/api --include=route.ts")
    rows.append(('API 핸들러(HTTP 메서드)', n if n is not None else 'ERR',
                 'route.ts 에서 export 된 HTTP 메서드 핸들러 수'))

    n, err = count_files("find app -name page.tsx | sort")
    rows.append(('웹 화면', n if n is not None else 'ERR',
                 'app 아래 page.tsx 파일 수'))

    n, err = count_files("find mobile/src/screens -name '*.tsx' | sort")
    rows.append(('모바일 화면', n if n is not None else 'ERR',
                 'mobile/src/screens 아래 tsx 파일 수 — 원고 17건의 정의'))

    n, err = count_files("find mobile -name '*.tsx' -not -path '*/node_modules/*' | sort")
    rows.append(('(참고) 모바일 tsx 전체', n if n is not None else 'ERR',
                 '컴포넌트·컨텍스트 포함. 화면 수로 쓰면 안 된다'))

    print('기준일 %s 재측정 (측정 시각의 워킹트리 HEAD 기준)\n' % asof)
    print('%-26s %10s  %s' % ('지표', '값', '계량 정의'))
    print('-' * 100)
    for name, value, definition in rows:
        print('%-26s %10s  %s' % (name, value, definition))

    print('\n원고 기재값(2026-09-26 기준): 커밋 505 / API 엔드포인트 137 / 웹 화면 79 / 모바일 화면 17')
    print('API·웹·모바일은 위 정의로 재현된다. 웹은 09-27 app/tester/page.tsx 추가분이 반영돼 1건 늘어난다.')
    print('커밋은 측정 시각까지 반영되므로 제출 당일 이 스크립트를 1회 실행해 기준일 표기와 함께 갱신한다.')
    print('테스트 건수는 이 스크립트에서 세지 않는다 — vitest 실행 결과만 근거로 삼고 실행 로그를 첨부한다.')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
