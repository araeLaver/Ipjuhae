#!/usr/bin/env python3
"""korealbs 페이지 본문 텍스트 덤프 — DOW-1273.

HTML 주석·스크립트를 제거하고 블록 경계를 줄바꿈으로 보존해
모집요강 원문 수치(지원 횟수·기간·비용·절차)를 눈으로 대조할 수 있게 만든다.
사용: dump_korealbs_page_text.py <저장된-html> [시작키워드]
"""
import html as htmllib
import re
import sys


def main():
    doc = open(sys.argv[1]).read()
    anchor = sys.argv[2] if len(sys.argv) > 2 else None
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 140

    doc = re.sub(r"<script.*?</script>", " ", doc, flags=re.S | re.I)
    doc = re.sub(r"<style.*?</style>", " ", doc, flags=re.S | re.I)
    doc = re.sub(r"<!--.*?-->", " ", doc, flags=re.S)
    doc = re.sub(r"<(br|/tr|/td|/th|/p|/li|/h[1-6]|/div)[^>]*>", "\n", doc, flags=re.I)
    doc = re.sub(r"<[^>]+>", " ", doc)
    text = htmllib.unescape(doc)

    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    start = 0
    if anchor:
        start = next((i for i, ln in enumerate(lines) if anchor in ln), 0)
    for ln in lines[start : start + limit]:
        print(ln)


if __name__ == "__main__":
    main()
