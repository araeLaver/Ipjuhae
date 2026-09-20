#!/usr/bin/env python3
"""DOW-909 트리거 B 점검 — 영업비밀·기술 보호 컨설팅 공고 접수 상태 확인.

CEO 판정(2026-09-20)으로 심화컨설팅 신청은 시점 보류 상태이고, 사업개발이
'예산 소진 임박'(트리거 B) 신호만 상시 감시한다. 이 스크립트는 그 감시를
매번 손으로 하지 않도록 자동화한 것이다.

WebFetch를 쓰지 않는 이유:
    이 워크스페이스의 WebFetch 권한은 claude.ai 도메인만 허용되어 있어
    정부 사이트 요청이 권한 거부로 죽는다. 거부를 '신호 없음'으로 착각하면
    감시가 통째로 허구가 되므로, urllib으로 직접 받아 확인한다.

사용:
    python3 scripts/check_trade_secret_notice.py

종료 코드:
    0  트리거 B 미발동 (이상 없음)
    1  트리거 B 발동 의심 — DOW-909를 high로 올리고 CEO에게 보고할 것
    2  점검 실패 (네트워크/구조 변경) — 조용히 넘기지 말 것
"""

import re
import ssl
import sys
import urllib.error
import urllib.request
from datetime import date, datetime

LIST_URL = "https://www.tradesecret.or.kr/bbs/noticeList.do?gb=251"
VIEW_URL = "https://www.tradesecret.or.kr/bbs/noticeView.do?gb=251&ntt_id={ntt_id}"
MOIP_URL = (
    "https://www.moip.go.kr/ko/kpoBultnDetail.do"
    "?aprchId=BUT0000079&menuCd=SCD0201381&ntatcSeq=29&sysCd=SCD02"
)

# 공고 제목에서 이 사업을 식별하는 키워드 (센터가 표기를 조금씩 바꾼다)
TITLE_KEYS = ("영업비밀", "컨설팅", "모집")

# 뜨면 트리거 B 발동으로 보는 문구
ALERT_PHRASES = ("접수 마감", "예산 소진", "잔여", "한정", "조기 마감", "접수 중단", "모집 종료")

# 연중 상시임을 뒷받침하는 문구 (사라지면 경고)
STEADY_PHRASES = ("연중 상시", "예산 소진 전까지")

# 최신 공고가 이 일수 넘게 갱신되지 않으면 경고
STALE_DAYS = 60

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


def fetch(url):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        raw = r.read()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("euc-kr", "replace")


def to_text(html):
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = h.replace("&nbsp;", " ").replace("&amp;", "&").replace("&middot;", "·")
    return re.sub(r"\s+", " ", h).strip()


def find_latest_notice(list_html):
    """공지 목록에서 컨설팅 모집 공고의 (ntt_id, 제목, 작성일자)를 찾는다."""
    rows = re.findall(
        r'ntt_id="(\d+)"[^>]*>(.*?)(\d{4}-\d{2}-\d{2})',
        re.sub(r"(?s)<(?!/?a\b)[^>]+>", " ", list_html),
        re.S,
    )
    for ntt_id, blob, posted in rows:
        title = re.sub(r"(-->|<!--)", " ", to_text(blob))
        title = re.sub(r"\s+", " ", title).strip()
        if all(k in title for k in TITLE_KEYS):
            return ntt_id, title, posted
    return None, None, None


def main():
    problems = []
    alerts = []

    try:
        list_html = fetch(LIST_URL)
    except (urllib.error.URLError, OSError) as e:
        print("[FAIL] 센터 공지 목록을 받지 못했습니다: %s" % e)
        return 2

    ntt_id, title, posted = find_latest_notice(list_html)
    if not ntt_id:
        print("[FAIL] 목록에서 컨설팅 모집 공고 행을 찾지 못했습니다. 게시판 구조가 바뀌었을 수 있습니다.")
        print("       확인: %s" % LIST_URL)
        return 2

    print("최신 센터 공고: %s" % title)
    print("  게시일   : %s" % posted)
    print("  상세 URL : %s" % VIEW_URL.format(ntt_id=ntt_id))

    try:
        posted_date = datetime.strptime(posted, "%Y-%m-%d").date()
        age = (date.today() - posted_date).days
        print("  경과일수 : %d일" % age)
        if age > STALE_DAYS:
            alerts.append("최신 공고가 %d일째 갱신 없음 (기준 %d일)" % (age, STALE_DAYS))
    except ValueError:
        problems.append("게시일 파싱 실패: %r" % posted)

    # 상세 본문 — 공고 호수와 경고 문구
    try:
        detail = to_text(fetch(VIEW_URL.format(ntt_id=ntt_id)))
        nums = re.findall(r"제\s*\d{4}-\s*\d+\s*호", detail)
        print("  공고 호수: %s" % (", ".join(dict.fromkeys(nums)) or "(본문에 표기 없음)"))
        hit = [p for p in ALERT_PHRASES if p in detail]
        if hit:
            alerts.append("센터 공고 본문에 마감 신호 문구: %s" % ", ".join(hit))
    except (urllib.error.URLError, OSError) as e:
        problems.append("센터 공고 상세를 받지 못했습니다: %s" % e)

    # 지식재산처 원공고 — 연중 상시 문구 유지 여부
    try:
        moip = to_text(fetch(MOIP_URL))
        missing = [p for p in STEADY_PHRASES if p not in moip]
        if missing:
            alerts.append("원공고에서 상시 접수 문구 사라짐: %s" % ", ".join(missing))
        else:
            print("  원공고   : '연중 상시 모집 / 예산 소진 전까지' 문구 유지")
    except (urllib.error.URLError, OSError) as e:
        problems.append("지식재산처 원공고를 받지 못했습니다: %s" % e)

    print()
    if problems:
        for p in problems:
            print("[FAIL] %s" % p)
        return 2
    if alerts:
        for a in alerts:
            print("[ALERT] %s" % a)
        print()
        print("트리거 B 발동 의심 — DOW-909 우선순위를 high로 올리고 CEO에게 보고하세요.")
        return 1

    print("[OK] 트리거 B 미발동. 접수 마감·예산 소진 신호 없음.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
