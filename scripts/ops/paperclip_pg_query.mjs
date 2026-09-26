// Paperclip 임베디드 Postgres 읽기 조회기.
// 사용: node paperclip_pg_query.mjs <base64(SQL)>   → stdout에 JSON rows
// psql 바이너리가 없는 환경(임베디드 postgres 패키지는 initdb/pg_ctl/postgres만 제공)에서 쓴다.
// SQL은 base64로 넘긴다 — 셸이 따옴표/중괄호를 뭉개는 것을 피하기 위함.
import pg from "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg/lib/index.js";

const PORT = process.env.PAPERCLIP_PG_PORT ?? "54329";
const c = new pg.Client({ connectionString: `postgres://paperclip:paperclip@127.0.0.1:${PORT}/paperclip` });
await c.connect();
const sql = Buffer.from(process.argv[2], "base64").toString("utf8");
const r = await c.query(sql);
console.log(JSON.stringify(r.rows, null, 1));
await c.end();
