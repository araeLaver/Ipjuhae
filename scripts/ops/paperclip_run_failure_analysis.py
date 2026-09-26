"""종결된 heartbeat_run 전수를 로그 원문과 대조해 실패 서명을 집계한다 (DOW-1248).

집계 API가 아니라 run-log ndjson 원문을 읽는다는 점이 핵심이다.
run의 exit_code/error는 "마지막으로 시도한 폴백 어댑터"의 것이므로,
1차 어댑터(codex)의 실제 실패 사유는 로그 원문에만 남는다.

사용: python3 paperclip_run_failure_analysis.py [YYYY-MM-DD]
"""
import base64, datetime, json, os, re, subprocess, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
QUERY = os.path.join(HERE, "paperclip_pg_query.mjs")
LOG_ROOT = os.path.expanduser("~/.paperclip/instances/default/data/run-logs/")

SIGNATURES = {
    "codex_usage_limit": "hit your usage limit",
    "claude_five_hour": '"rateLimitType":"five_hour"',
    "claude_out_of_credits": "out_of_credits",
    "claude_session_limit": "hit your session limit",
    "gemini_no_api_key": "you must specify the GEMINI_API_KEY",
    "yolo_banner": "YOLO mode is enabled",
}


def sql(query):
    r = subprocess.run(["node", QUERY, base64.b64encode(query.encode()).decode()],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("SQL failed: " + r.stderr[:500])
    return json.loads(r.stdout)


def main(day):
    rows = sql(
        "select id, agent_id, status, exit_code, started_at, finished_at, log_ref "
        f"from heartbeat_runs where created_at > '{day} 00:00:00+00' "
        f"and created_at < '{day} 00:00:00+00'::timestamptz + interval '1 day' "
        "and finished_at is not null order by started_at"
    )
    status_total, sig, exits, reset_texts, missing = Counter(), Counter(), Counter(), Counter(), 0
    for r in rows:
        status_total[r["status"]] += 1
        exits[(r["status"], r["exit_code"])] += 1
        path = LOG_ROOT + (r.get("log_ref") or "")
        if not r.get("log_ref") or not os.path.exists(path):
            missing += 1
            continue
        blob = open(path, errors="replace").read()
        for name, needle in SIGNATURES.items():
            if needle in blob:
                sig[(r["status"], name)] += 1
        for m in re.finditer(r"try again at ([^.\"]+)", blob):
            reset_texts[m.group(1)[:40]] += 1
        for m in re.finditer(r"rate_limit_info[^}]*\}", blob):
            b = m.group(0).replace('\\"', '"')
            t = re.search(r'"rateLimitType":"([a-z_]+)"', b)
            st = re.search(r'"status":"([a-z_]+)"', b)
            rs = re.search(r'"resetsAt":(\d+)', b)
            when = (datetime.datetime.fromtimestamp(int(rs.group(1)) + 9 * 3600, datetime.UTC)
                    .strftime("%m-%d %H:%M KST")) if rs else "?"
            sig[(r["status"], f"claude:{t.group(1) if t else '?'}:{st.group(1) if st else '?'}:{when}")] += 1

    print(f"== {day} 종결 런 {sum(status_total.values())}건: {dict(status_total)} (로그 누락 {missing}건)")
    print("-- exit_code 분포 --")
    for k, v in sorted(exits.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    print("-- 로그 원문 서명 --")
    for k, v in sorted(sig.items(), key=lambda x: -x[1]):
        print(f"  {v:4d}  {k}")
    print("-- 공급자가 알려준 재시도 시각 --")
    for k, v in reset_texts.most_common(10):
        print(f"  {v:4d}  {k!r}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat())
