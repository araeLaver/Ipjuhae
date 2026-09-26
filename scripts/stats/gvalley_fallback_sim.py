"""서식2 도표 표 대체·분량 보정 원고 적용 시 실제 페이지 수 시뮬레이션.

통합 원고(v5)를 원본으로 두고 세 변형을 임시 파일로 만들어
gvalley_page_budget.py 로 계량한다. 저장소 원고는 수정하지 않는다.

  A: 도표 3종을 mermaid -> 대체 표로 교체
  B: A + 분량 보정 원고(1.3 / 3.2) 삽입
  C: 원본(이미지 경로) + 분량 보정 원고 삽입

사용법: python3 scripts/stats/gvalley_fallback_sim.py [출력디렉터리]
"""

import os
import re
import subprocess
import sys

BD = 'docs/business-development'
V5 = f'{BD}/20260926_gvalley_application_package_v5.md'
FALLBACK = f'{BD}/20260926_gvalley_form2_diagram_fallback.md'
COMP = f'{BD}/20260926_gvalley_form2_pagecount_compensation.md'
BUDGET = 'scripts/stats/gvalley_page_budget.py'


def read(path):
    return open(path, encoding='utf-8').read()


def fallback_tables(text):
    """대체 표 3종을 문서 순서(도표 1·2·3)대로 뽑는다."""
    return [m.group(1) for m in
            re.finditer(r'## 도표 \d 대체[^\n]*\n\n((?:\|[^\n]*\n)+)', text)]


def swap_diagrams(src, tables):
    """v5의 mermaid 블록을 대체 표로 교체한다 (본문 등장 순서: 도표2·1·3)."""
    order = [tables[1], tables[0], tables[2]]
    blocks = list(re.finditer(r'```mermaid\n.*?```\n', src, re.S))
    if len(blocks) != 3:
        raise SystemExit('mermaid 블록이 3개가 아니다: %d' % len(blocks))
    out = src
    for i in range(2, -1, -1):
        m = blocks[i]
        out = out[:m.start()] + order[i] + out[m.end():]
    return out


def comp_blocks(text):
    """보정 원고 문서에서 인용 블록(이식 원고)만 절별로 뽑는다."""
    out = {}
    for key, head in (('1.3', '## 2. 보정 원고 1'), ('3.2', '## 3. 보정 원고 2')):
        i = text.index(head)
        j = text.index('\n## ', i + 1)
        lines = [l[2:] if l.startswith('> ') else '' for l in text[i:j].split('\n')
                 if l.startswith('>')]
        out[key] = '\n'.join(lines).strip()
    return out


def insert_after(text, anchor, payload):
    k = text.index(anchor)
    nxt = text.index('\n#### ', k + 1)
    return text[:nxt] + '\n\n' + payload + '\n' + text[nxt:]


def apply_comp(text, blocks):
    text = insert_after(text, '#### 1.3', blocks['1.3'])
    return insert_after(text, '#### 3.2', blocks['3.2'])


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    src = read(V5)
    tables = fallback_tables(read(FALLBACK))
    blocks = comp_blocks(read(COMP))

    variants = [
        ('원본 v5 (이미지 경로, 보정 없음)', src),
        ('A 표 대체, 보정 없음', swap_diagrams(src, tables)),
        ('B 표 대체 + 보정 원고', apply_comp(swap_diagrams(src, tables), blocks)),
        ('C 이미지 + 보정 원고', apply_comp(src, blocks)),
    ]
    for i, (label, body) in enumerate(variants):
        path = os.path.join(outdir, 'variant_%d.md' % i)
        open(path, 'w', encoding='utf-8').write(body)
        res = subprocess.run([sys.executable, BUDGET, path],
                             capture_output=True, text=True)
        tail = [l for l in res.stdout.split('\n')
                if re.match(r'^(합계|1100|1300|1500)', l.strip())]
        print('== %s' % label)
        for l in tail:
            print('   ' + l.strip())


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'docs/tmp/gvalley_sim')
