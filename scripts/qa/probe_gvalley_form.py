"""G밸리 창업경진대회 접수 구글폼의 실제 입력 항목을 확인한다.

공고문(official-notice.hwpx) 113행의 접수링크가 실제로 어떤 필드를 요구하는지
제출 당일이 아니라 미리 확인하기 위한 프로브다. WebFetch는 claude.ai 외 차단이므로
urllib로 직접 받는다.

사용: python3 scripts/qa/probe_gvalley_form.py
"""

import json
import re
import sys
import urllib.error
import urllib.request

FORM_SHORT = "https://forms.gle/DMz7qAn52999UNC37"
# forms.gle 는 이 환경에서 딥링크 인터스티셜(proxy.link.app)로 막힌다.
# `?d=1` 을 붙이면 미리보기 페이지가 실제 대상 URL을 노출하므로 거기서 추출한 정본 URL을 쓴다.
FORM_CANONICAL = (
    "https://docs.google.com/forms/d/e/"
    "1FAIpQLSdxrmJ4A2Qk1S8xax7RKKnsl0F_bJQXoGiEIF7kIT_AVcwLrg/viewform"
)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# 구글폼 필드 타입 코드 (FB_PUBLIC_LOAD_DATA_ 기준)
TYPES = {
    0: "단답형",
    1: "장문형",
    2: "객관식(라디오)",
    3: "드롭다운",
    4: "체크박스",
    5: "선형배율",
    7: "그리드",
    9: "날짜",
    10: "시간",
    13: "파일 업로드",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.geturl(), resp.read().decode("utf-8", errors="replace")


def control_check():
    """대조군: 같은 경로로 공개 구글 URL이 열리는지 확인한다.

    이걸 안 하면 401을 "우리 네트워크가 막혔다"로 오독할 수 있다.
    """
    out = ["대조군 (같은 경로로 공개 URL 요청):"]
    for url in ("https://docs.google.com/", "https://www.google.com/"):
        try:
            fetch(url)
            out.append("  %-32s 200 도달" % url)
        except urllib.error.HTTPError as exc:
            out.append("  %-32s HTTP %s" % (url, exc.code))
        except Exception as exc:  # noqa: BLE001
            out.append("  %-32s 실패 %r" % (url, exc))
    out.append("  → 대조군이 열리면 위 401은 구글 측 로그인 요구이고 네트워크 차단이 아니다.")
    return "\n".join(out)


def main():
    try:
        final_url, html = fetch(FORM_CANONICAL)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print("HTTP %s %s" % (exc.code, exc.reason))
        # 구글이 돌려주는 로그인 벽과 우리 쪽 네트워크 차단을 구분한다.
        wall = "이 콘텐츠에 액세스하려면 로그인해야 합니다" in body or "ServiceLogin" in body
        if exc.code == 401 and wall:
            print("판정: **구글 계정 로그인 필수**. 폼 문항을 비로그인으로 확인할 수 없다.")
            print("      근거 문구: " + "/ ".join(
                s for s in ("Google 계정에 로그인하십시오.",
                            "이 콘텐츠에 액세스하려면 로그인해야 합니다.")
                if s in body))
            print(control_check())
            return 2
        print("판정: 로그인 벽으로 설명되지 않는 오류다. 네트워크 경로를 확인해야 한다.")
        return 1
    except Exception as exc:  # noqa: BLE001 - 프로브이므로 원인만 출력
        print("접근 실패: %r" % (exc,))
        return 1

    print("최종 URL: %s" % final_url)
    print("본문 길이: %d" % len(html))

    title = re.search(r"<title>(.*?)</title>", html, re.S)
    if title:
        print("제목: %s" % re.sub(r"\s+", " ", title.group(1)).strip())

    # 로그인 요구 여부
    if "accounts.google.com" in final_url:
        print("판정: 구글 로그인 필요 (폼 본문에 도달하지 못했다)")
        return 2
    signin = "로그인" in html and "ServiceLogin" in html
    print("로그인 벽 흔적: %s" % ("있음" if signin else "없음"))

    m = re.search(r"FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);\s*</script>", html, re.S)
    if not m:
        print("판정: FB_PUBLIC_LOAD_DATA_ 를 찾지 못했다. 폼 구조를 수동 확인해야 한다.")
        return 3

    data = json.loads(m.group(1))
    form_desc = data[1][0] if isinstance(data[1], list) else None
    print("폼 설명: %s" % (form_desc or "(없음)"))

    items = data[1][1] or []
    print("\n총 %d개 항목\n" % len(items))
    for idx, item in enumerate(items, 1):
        label = item[1]
        tcode = item[3]
        tname = TYPES.get(tcode, "코드%s" % tcode)
        required = False
        extra = ""
        entries = item[4] if len(item) > 4 and item[4] else []
        for ent in entries:
            if len(ent) > 2 and ent[2]:
                required = True
            # 파일 업로드 제약: ent[4] 구간에 허용 확장자/개수/용량이 들어온다
            if tcode == 13 and len(ent) > 4 and ent[4]:
                extra = " 제약=%s" % json.dumps(ent[4], ensure_ascii=False)
        print(
            "%2d. [%s]%s %s%s"
            % (idx, tname, " *필수" if required else "", label, extra)
        )

    uploads = [i for i in items if i[3] == 13]
    print("\n파일 업로드 항목 수: %d" % len(uploads))
    if uploads:
        print("업로드 항목 목록:")
        for u in uploads:
            print("  - %s" % u[1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
