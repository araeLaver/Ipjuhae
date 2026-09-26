"""실패가 "간헐적"인지 "5시간 한도 창의 꼬리"인지 가른다 (DOW-1248).

세 가지를 출력한다.
1. 시간별 성공/실패 — 정전 구간의 경계
2. 5시간 창 내 경과시간별 실패율 — 창 리셋 후 몇 분까지 살아 있는지
3. 동시 기동(같은 초에 시작한 런) 수별 실패율 — 창 위치를 통제한 값도 함께

사용: python3 paperclip_quota_window_analysis.py [YYYY-MM-DD] [앵커시(UTC, 기본 3)]
"""
import base64, datetime, json, os, subprocess, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
QUERY = os.path.join(HERE, "paperclip_pg_query.mjs")


def sql(query):
    r = subprocess.run(["node", QUERY, base64.b64encode(query.encode()).decode()],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("SQL failed: " + r.stderr[:500])
    return json.loads(r.stdout)


def rate(counter):
    total = counter["succeeded"] + counter["failed"]
    return total, counter["failed"], (100 * counter["failed"] / total if total else 0)


def main(day, anchor_hour):
    rows = sql(
        "select status, started_at, invocation_source from heartbeat_runs "
        f"where created_at > '{day} 00:00:00+00' "
        f"and created_at < '{day} 00:00:00+00'::timestamptz + interval '1 day' "
        "and finished_at is not null and started_at is not null order by started_at"
    )
    per_hour, per_offset, by_second = defaultdict(Counter), defaultdict(Counter), defaultdict(list)
    for r in rows:
        t = datetime.datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))
        offset = ((t.hour - anchor_hour) % 5) * 60 + t.minute
        per_hour[r["started_at"][:13]][r["status"]] += 1
        per_offset[offset // 30][r["status"]] += 1
        by_second[r["started_at"][:19]].append((r["status"], offset, r["invocation_source"]))

    print(f"== {day} 시간별 (UTC) ==")
    for h in sorted(per_hour):
        c = per_hour[h]
        print(f"  {h}  ok={c['succeeded']:3d} fail={c['failed']:3d}")

    print(f"== 5시간 창 내 경과시간별 실패율 (앵커 {anchor_hour:02d}:00Z) ==")
    for off in sorted(per_offset):
        total, fail, pct = rate(per_offset[off])
        print(f"  {off*30:4d}~{off*30+29:4d}분  런={total:4d} 실패={fail:4d} {pct:3.0f}%")

    for label, limit in (("전 구간", 10 ** 9), ("창 리셋 후 120분 이내", 120)):
        buckets, sources = defaultdict(Counter), defaultdict(Counter)
        for items in by_second.values():
            n = len(items)
            for status, offset, src in items:
                if offset < limit:
                    buckets[n][status] += 1
                    sources[n][src] += 1
        print(f"== 동시 기동 수별 실패율 ({label}) ==")
        for n in sorted(buckets):
            total, fail, pct = rate(buckets[n])
            if total:
                print(f"  동시={n} 런={total:4d} 실패={fail:4d} {pct:3.0f}%  source={dict(sources[n])}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat(),
         int(sys.argv[2]) if len(sys.argv) > 2 else 3)
