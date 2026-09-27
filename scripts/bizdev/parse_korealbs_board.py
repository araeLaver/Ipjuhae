#!/usr/bin/env python3
"""korealbs 온라인 컨설팅 신청 게시판 실측 — DOW-1273.

두 가지를 확정한다.
1) 이 창구가 실제로 답변을 주고 있는지(등록일 대비 답변일 공백)
2) 제목·작성자명이 로그인 없이 공개 노출되는지(기밀성 판정)
사용: parse_korealbs_board.py <저장된-html>
"""
import html as htmllib
import json
import re
import sys


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", htmllib.unescape(s)).strip()


def main():
    doc = open(sys.argv[1]).read()
    doc = re.sub(r"<!--.*?-->", " ", doc, flags=re.S)
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", doc, re.S | re.I):
        tds = [clean(c) for _t, c in re.findall(r"<(td)[^>]*>(.*?)</\1>", tr, re.S | re.I)]
        tds = [c for c in tds if c != ""]
        if not tds or not tds[0].isdigit():
            continue
        dates = re.findall(r"\d{4}-\d{2}-\d{2}", " ".join(tds))
        rows.append(
            {
                "no": int(tds[0]),
                "title": tds[1] if len(tds) > 1 else None,
                "cells": tds,
                "registered": dates[0] if dates else None,
                "answered": dates[1] if len(dates) > 1 else None,
            }
        )

    answered = [r for r in rows if r["answered"]]
    print(
        json.dumps(
            {
                "row_count": len(rows),
                "answered_count": len(answered),
                "date_range": [
                    min((r["registered"] for r in rows if r["registered"]), default=None),
                    max((r["registered"] for r in rows if r["registered"]), default=None),
                ],
                "rows": rows,
            },
            ensure_ascii=False,
            indent=1,
        )
    )


if __name__ == "__main__":
    main()
