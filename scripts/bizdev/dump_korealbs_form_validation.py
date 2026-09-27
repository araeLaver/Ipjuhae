#!/usr/bin/env python3
"""korealbs 신청서의 클라이언트 검증 로직 추출 — DOW-1273.

라벨의 별표(*)와 실제 JS 필수값 검증이 일치하는지 대조하기 위한 스크립트.
HTML 표기만 믿으면 실제 제출 시 막히는 항목을 놓친다.
"""
import re
import sys


def main():
    doc = open(sys.argv[1]).read()
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", doc, re.S | re.I)
    src = "\n".join(scripts)

    print("== 함수 목록 ==")
    for m in re.finditer(r"function\s+(\w+)\s*\(([^)]*)\)", src):
        print(" ", m.group(1) + "(" + m.group(2) + ")")

    print()
    print("== 검증 관련 라인 ==")
    keys = ("frm.", "value", "focus", "alert", "checked", "submit", "action")
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        if any(k in line for k in keys) and len(line) < 220:
            print(" ", line)


if __name__ == "__main__":
    main()
