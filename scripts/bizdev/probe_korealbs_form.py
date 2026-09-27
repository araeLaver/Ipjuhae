#!/usr/bin/env python3
"""korealbs.or.kr (한국LBS산업협의회) 온라인 신청서 구조 실측 프로브 — DOW-1273.

목적: KISA 위치정보 맞춤형 컨설팅 신청 폼의 필수 입력 항목을 추측이 아니라
실제 HTML 노드로 확정한다. 로그인 필요 여부, 첨부 서류 요구 여부까지 판정한다.
"""
import json
import re
import ssl
import sys
import urllib.error
import urllib.request

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            raw = resp.read()
            for enc in ("utf-8", "euc-kr", "cp949"):
                try:
                    return {
                        "url": url,
                        "status": resp.status,
                        "final_url": resp.geturl(),
                        "content_type": resp.headers.get("Content-Type"),
                        "bytes": len(raw),
                        "encoding": enc,
                        "text": raw.decode(enc),
                    }
                except UnicodeDecodeError:
                    continue
            return {
                "url": url,
                "status": resp.status,
                "final_url": resp.geturl(),
                "bytes": len(raw),
                "encoding": "undecodable",
                "text": raw.decode("utf-8", "replace"),
            }
    except urllib.error.HTTPError as exc:
        return {"url": url, "status": exc.code, "error": "HTTPError", "text": ""}
    except Exception as exc:  # noqa: BLE001 - 네트워크 계층 오류 전부 기록
        return {"url": url, "status": None, "error": f"{type(exc).__name__}: {exc}", "text": ""}


def strip_tags(html):
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def summarize_form(res):
    html = res.get("text", "")
    title = re.findall(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    forms = re.findall(r"<form[^>]*>", html, re.I)
    inputs = re.findall(r"<(?:input|select|textarea)[^>]*>", html, re.I)
    fields = []
    for tag in inputs:
        name = re.search(r'name\s*=\s*["\']([^"\']+)', tag, re.I)
        itype = re.search(r'type\s*=\s*["\']([^"\']+)', tag, re.I)
        required = bool(re.search(r"\brequired\b", tag, re.I))
        fields.append(
            {
                "name": name.group(1) if name else None,
                "type": (itype.group(1) if itype else tag.split()[0].lstrip("<").lower()),
                "required_attr": required,
            }
        )
    body = strip_tags(html)
    return {
        "url": res["url"],
        "final_url": res.get("final_url"),
        "status": res.get("status"),
        "error": res.get("error"),
        "encoding": res.get("encoding"),
        "bytes": res.get("bytes"),
        "title": title[0].strip() if title else None,
        "form_tags": forms,
        "field_count": len(fields),
        "fields": fields,
        "login_markers": sorted(
            {
                m
                for m in ["로그인", "회원가입", "아이디", "비밀번호", "login", "userId"]
                if m.lower() in body.lower()
            }
        ),
        "attachment_markers": sorted(
            {
                m
                for m in ["첨부", "파일", "사업자등록", "확인서", "증빙"]
                if m in body
            }
        ),
        "text_head": body[:1200],
    }


def main():
    targets = sys.argv[1:] or [
        "https://www.korealbs.or.kr/",
        "http://www.korealbs.or.kr/",
    ]
    out = []
    for url in targets:
        res = fetch(url)
        out.append(summarize_form(res))
        if res.get("status") == 200 and res.get("text"):
            safe = re.sub(r"[^a-z0-9]+", "_", url.lower()).strip("_")
            with open(f"/tmp/{safe}.html", "w") as fh:
                fh.write(res["text"])
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
