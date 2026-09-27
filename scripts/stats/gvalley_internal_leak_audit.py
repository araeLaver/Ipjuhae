"""서식2 제출 본문에 남은 내부 서술(내부 절차·내부 링크·집필 지시문) 감사.

통합 원고의 서식2 구간에서 심사위원이 읽으면 안 되는 내부 문장을 식별하고,
그 문장을 제거한 변형본을 만들어 gvalley_page_budget.py 로 재계량한다.
목적은 두 가지다.

  1) 제출본에 남으면 안 되는 문장 목록을 문자열 단위로 고정한다.
  2) 그 문장을 지웠을 때 최소 5쪽 요건이 흔들리는지 수치로 본다.

대조군 규율: 지정한 문자열이 원고에서 발견되지 않으면 실패로 보고한다.
"조용히 0건 제거"가 통과처럼 보이는 것을 막는다.

사용법: python3 scripts/stats/gvalley_internal_leak_audit.py <통합원고.md> [출력디렉터리]
"""

import os
import subprocess
import sys

BUDGET = 'scripts/stats/gvalley_page_budget.py'

# (식별자, 사유, 제거할 문자열)
LEAKS = [
    ('L1', '1.1 본문에 내부 검증 절차(CTO 검증) 서술',
     ' 아래 기술 설명은 설계 목표이며 실제 구현·배포 범위는 CTO 검증 후 확정한다.'),
    ('L2', '1.3 본문에 Paperclip 내부 문서 링크(출처 대장)',
     '수도권 비아파트 집계는 원룸·오피스텔만의 통계가 아니다. 통계별 원문 위치·기준연도·집계 정의는 [출처 대장](/DOW/issues/DOW-1154#document-market-statistics)을 따른다.'),
    ('L3', '2.1 캡션에 내부 검수 절차 서술',
     ' 실제 구현·빌드·배포 상태는 기술 증빙 검수 결과를 반영해 확정한다.'),
    ('L4', '2.2 말미의 이식 규칙 블록 전체(집필 지시문)',
     '> 이식 규칙([확정 원고](/DOW/issues/DOW-1234#document-section22-evidence) 기준): 이 절에 증빙 판정을 받지 않은 기술 주장을 추가하지 않는다. 커밋 505건·테스트 861건은 매일 변하므로 **제출 당일 재측정하고 기준일 표기를 함께 갱신한다.** 특허 관련 서술 일체, 앱 출시·스토어 배포·iOS 지원, 이용자·검증·전환 수치, 공공데이터·위치인증 연계 완료, 시험 커버리지 수치, 스케줄러 운영 주체의 사실과 다른 표기는 모두 기재 금지다.\n'),
    ('L5', '2.3 본문에 내부 이슈 링크 + 제출본 편집 지시문',
     ' 구현·배포·실사용 여부는 [기술 증빙 검증](/DOW/issues/DOW-1235)에서 허용된 범위만 제출본에 반영한다.'),
    ('L6', '2.3 본문에 특허 서술(임시명세서·출원) — 같은 원고의 이식 규칙이 금지한 항목',
     ' 지식재산권은 [증빙 판정](/DOW/issues/DOW-1235#document-evidence-verification) 8번에 따라 **본문 전면 제외**한다. 임시명세서 단계로 특허청구범위·심사청구·공개신청이 모두 없고 출원번호통지서 원본이 미확보이므로, 출원 사실 자체를 기재할 수 없다.'),
    ('L7', '4장 본문에 내부 기한·배점 서술과 내부 프로필 링크',
     '**입력 없이 이 표만 남겨 제출하지 않는다.** 배점 20점 구간이며 [공통 프로필](/DOW/issues/DOW-1090#document-profile)의 경력값이 10월 5일까지 필요하다. 이 절은 현재 분량 추정 0.07쪽으로 사실상 공란이고 보드 입력 외에 대체 경로가 없다.'),
    ('L8', '5장 본문에 내부 판정 참조·특허/상표 상태 서술·내부 링크',
     '등록 지식재산권 표는 **공란으로 둔다.** 증빙 판정 8번에 따라 특허·상표의 번호와 출원·등록 상태는 증빙 미확보로 전면 제외이며, 등록이 확인된 건이 없으므로 기재할 항목이 없다. 상표는 [선행조사 기록](/DOW/issues/DOW-1154)상 출원 전 단계다. '),
]


def main(src_path, outdir='docs/tmp'):
    src = open(src_path, encoding='utf-8').read()
    os.makedirs(outdir, exist_ok=True)

    print('원고: %s\n' % src_path)
    print('%-4s %-6s %s' % ('id', '판정', '사유'))
    missing = []
    out = src
    removed_chars = 0
    for ident, reason, needle in LEAKS:
        n = out.count(needle)
        if n == 0:
            missing.append(ident)
            print('%-4s %-6s %s' % (ident, '미발견', reason))
            continue
        out = out.replace(needle, '', 1)
        removed_chars += len(needle)
        print('%-4s %-6s %s' % (ident, '제거', reason))

    print('\n지정 %d건 중 제거 %d건 / 미발견 %d건'
          % (len(LEAKS), len(LEAKS) - len(missing), len(missing)))
    if missing:
        print('미발견 항목: %s — 원고가 바뀌었거나 문자열이 어긋났다. 수치를 신뢰하지 말 것.'
              % ', '.join(missing))

    dst = os.path.join(outdir, 'gvalley_pkg_internal_removed.md')
    open(dst, 'w', encoding='utf-8').write(out)
    print('\n변형본: %s (문자열 기준 %d자 제거)\n' % (dst, removed_chars))

    for label, path in (('제거 전', src_path), ('제거 후', dst)):
        print('=' * 60)
        print(label)
        print('=' * 60)
        subprocess.run([sys.executable, BUDGET, path], check=True)
        print()

    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'docs/tmp/gvalley_pkg8.md',
                  sys.argv[2] if len(sys.argv) > 2 else 'docs/tmp'))
