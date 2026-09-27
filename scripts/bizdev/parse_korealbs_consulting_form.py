#!/usr/bin/env python3
"""korealbs 찾아가는 컨설팅 신청서(/2026/consulting1.asp) 항목 정밀 파싱 — DOW-1273.

probe_korealbs_form.py 가 필드 이름만 뽑는 데 비해, 이 스크립트는
표 셀(th/td) 단위로 라벨↔입력을 짝지어 **필수(*) 여부**와 radio/checkbox
선택지 문안을 원문 그대로 확정한다.
"""
import html as htmllib
import json
import re
import sys


def clean(s):
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    path = sys.argv[1]
    doc = open(path).read()

    # 본문 영역만: '컨설팅 신청하기' 이후
    body = doc
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S | re.I)
    out = []
    for row in rows:
        cells = re.findall(r"<(th|td)[^>]*>(.*?)</\1>", row, re.S | re.I)
        if not cells:
            continue
        label_parts, inputs = [], []
        for _tag, inner in cells:
            for m in re.finditer(r"<(input|select|textarea)([^>]*)>", inner, re.I):
                attrs = m.group(2)
                name = re.search(r'name\s*=\s*["\']?([^"\'\s>]+)', attrs, re.I)
                itype = re.search(r'type\s*=\s*["\']?([^"\'\s>]+)', attrs, re.I)
                val = re.search(r'value\s*=\s*["\']([^"\']*)', attrs, re.I)
                inputs.append(
                    {
                        "tag": m.group(1).lower(),
                        "name": name.group(1) if name else None,
                        "type": itype.group(1).lower() if itype else m.group(1).lower(),
                        "value": val.group(1) if val else None,
                    }
                )
            label_parts.append(clean(inner))
        label = " | ".join(p for p in label_parts if p)
        if not inputs and not label:
            continue
        # 별표(*) 표기 탐지: 원문의 <span class="star">*</span> 또는 * 문자
        required = "*" in row or "star" in row.lower()
        out.append({"label": label[:300], "required_marker": required, "inputs": inputs})

    # radio 선택지 라벨: label/텍스트가 input 뒤에 오는 구조를 별도 추출
    radios = []
    for m in re.finditer(
        r'<input[^>]*type=["\']?radio[^>]*name=["\']?(\w+)[^>]*value=["\']?([^"\'\s>]*)[^>]*>(.{0,200}?)(?=<input|</td>|</tr>)',
        body,
        re.S | re.I,
    ):
        radios.append({"name": m.group(1), "value": m.group(2), "label": clean(m.group(3))[:160]})

    checks = []
    for m in re.finditer(
        r'<input[^>]*type=["\']?checkbox[^>]*>(.{0,400}?)(?=<input|</td>|</tr>|</form>)',
        body,
        re.S | re.I,
    ):
        checks.append(clean(m.group(1))[:300])

    scripts = re.findall(r"<script[^>]*>(.*?)</script>", doc, re.S | re.I)
    alerts = []
    for s in scripts:
        alerts += [clean(a) for a in re.findall(r'alert\(\s*["\']([^"\']+)["\']', s)]

    print(
        json.dumps(
            {
                "rows": out,
                "radio_options": radios,
                "checkbox_labels": checks,
                "js_validation_alerts": alerts,
                "has_file_input": bool(re.search(r'type=["\']?file', doc, re.I)),
                "form_action": re.findall(r"<form[^>]*>", doc, re.I),
                "submit_targets": sorted(set(re.findall(r"(\w+\.asp)", doc))),
            },
            ensure_ascii=False,
            indent=1,
        )
    )


if __name__ == "__main__":
    main()
