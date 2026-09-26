"""HWPX 파일에서 본문 텍스트를 행 단위로 추출한다.

HWPX는 zip 컨테이너 안에 XML이 들어 있는 형식이므로 한컴오피스 없이 열 수 있다.
(HWP 바이너리는 이 방법으로 열리지 않는다 — 그쪽은 별도 도구가 필요하다.)

G밸리 공고문 원문 대조에 사용했다. 추출 결과의 행 번호가 그대로 인용 근거가 되므로
출력 순서는 문서의 `<hp:t>` 텍스트 런 순서를 그대로 따른다.

사용:
    python3 scripts/stats/extract_hwpx_text.py docs/business-development/gvalley-2026/official-notice.hwpx
    python3 scripts/stats/extract_hwpx_text.py <파일> --grep 제출 --grep PDF
"""

import argparse
import re
import sys
import zipfile


def extract(path):
    """HWPX의 모든 section XML에서 텍스트 런을 순서대로 뽑아 리스트로 돌려준다."""
    with zipfile.ZipFile(path) as z:
        sections = sorted(
            n for n in z.namelist()
            if n.endswith(".xml") and "section" in n.lower()
        )
        if not sections:
            raise SystemExit("section XML을 찾지 못했다: %s" % path)
        runs = []
        for name in sections:
            xml = z.read(name).decode("utf-8", errors="replace")
            for m in re.finditer(r"<hp:t>(.*?)</hp:t>", xml, re.S):
                runs.append(re.sub(r"<[^>]+>", "", m.group(1)))
    return runs


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--grep", action="append", default=[],
                    help="이 패턴을 포함한 행만 출력 (여러 번 지정 가능, OR 결합)")
    ap.add_argument("--out", help="추출 전문을 이 경로에 저장")
    args = ap.parse_args(argv)

    runs = extract(args.path)
    if args.out:
        with open(args.out, "w") as f:
            f.write("\n".join(runs))
        print("저장: %s (%d행)" % (args.out, len(runs)), file=sys.stderr)

    pattern = re.compile("|".join(re.escape(g) for g in args.grep)) if args.grep else None
    for idx, line in enumerate(runs, 1):
        if pattern and not pattern.search(line):
            continue
        print("%d: %s" % (idx, line.strip()))
    if not pattern:
        print("총 %d행" % len(runs), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
