"""G밸리 서식2 사업계획서 분량(페이지) 예산 산정.

통합 원고 markdown을 입력으로 받아 절별 본문 글자수·표 행수·도표 수를 세고,
HWP A4(함초롬바탕 10pt, 줄간격 160%) 기준 페이지 수를 추정한다.
추정치는 실제 HWP 출력 검수를 대체하지 않는다. 최소 5쪽 요건 충족 여부의
사전 경보용으로만 사용한다.

사용법: python3 scripts/stats/gvalley_page_budget.py <통합원고.md>
"""

import re
import sys

# A4 / 함초롬바탕 10pt / 줄간격 160% / 여백 기본 가정
CHARS_PER_PAGE = (1100, 1300, 1500)  # 보수·중립·낙관
TABLE_ROW_PAGE = 0.030               # 표 1행당 페이지 환산(머리행·괘선 포함)
DIAGRAM_PAGE = 0.35                  # 도표 1종당 페이지 환산(캡션 제외)


def split_sections(lines, start, end, level='### '):
    secs, cur = [], None
    for line in lines[start:end]:
        if line.startswith(level):
            cur = {'title': line[len(level):].strip(), 'lines': []}
            secs.append(cur)
        elif cur is not None:
            cur['lines'].append(line)
    return secs


def strip_fenced(lines):
    """코드펜스(```) 내부는 본문에서 제외한다.

    도표는 이미지로 삽입되므로 mermaid 소스 자체는 출력물의 본문 글자가
    아니다. 이 구분을 하지 않으면 도표 소스가 본문으로 이중 계산되어
    페이지 수가 과대 추정된다.
    """
    out, inside = [], False
    for line in lines:
        if line.strip().startswith('```'):
            inside = not inside
            continue
        if not inside:
            out.append(line)
    return out


def measure(lines):
    text = '\n'.join(lines)
    rows = [l for l in lines if l.strip().startswith('|')]
    diagrams = text.count('```') // 2
    prose = [l for l in strip_fenced(lines)
             if l.strip()
             and not l.strip().startswith('|')
             and not l.strip().startswith('#')]
    flat = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', '\n'.join(prose))
    flat = re.sub(r'[*`>]', '', flat)
    return len(re.findall(r'\S', flat)), len(rows), diagrams


def main(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    heads = [i for i, l in enumerate(lines) if l.startswith('## ')]
    start = next(i for i in heads if '서식2' in lines[i])
    end = next((i for i in heads if i > start), len(lines))

    print('대상: %s (서식2 구간 %d~%d행)\n' % (path, start + 1, end))
    total_chars = total_rows = total_diagrams = 0
    print('%-26s %8s %6s %5s' % ('절', '본문글자', '표행', '도표'))
    for sec in split_sections(lines, start, end):
        chars, rows, diagrams = measure(sec['lines'])
        total_chars += chars
        total_rows += rows
        total_diagrams += diagrams
        print('%-26s %8d %6d %5d' % (sec['title'][:24], chars, rows, diagrams))
    print('%-26s %8d %6d %5d' % ('합계', total_chars, total_rows, total_diagrams))

    fixed = total_rows * TABLE_ROW_PAGE + total_diagrams * DIAGRAM_PAGE
    print('\n표·도표 고정 분량: %.2f쪽 (표 %d행 x %.3f + 도표 %d종 x %.2f)'
          % (fixed, total_rows, TABLE_ROW_PAGE, total_diagrams, DIAGRAM_PAGE))
    print('\n%-10s %8s %8s %8s' % ('가정', '본문쪽', '합계쪽', '최소5쪽'))
    for cpp in CHARS_PER_PAGE:
        body = total_chars / cpp
        total = body + fixed
        print('%-10s %8.2f %8.2f %8s'
              % ('%d자/쪽' % cpp, body, total, '충족' if total >= 5 else '미달'))
    print('\n주: 표지·유의사항 페이지와 절 제목·표 캡션의 빈 공간은 포함하지 않았다.')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'pkg.md')
