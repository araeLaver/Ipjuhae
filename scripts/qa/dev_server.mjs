// 로컬 실측용 dev 서버를 node 로 직접 띄운다.
//
// 왜: `next dev` 바이너리 실행이 막힌 셸에서도 실제 HTTP 응답을 실측해야 할 때가 있다.
// 라우트 핸들러를 직접 import 해서 부르는 방법은 요청 컨텍스트(cookies 등)가 없어
// 실제 응답과 갈라지므로, 진짜 서버를 띄우는 쪽을 택한다.
//
// 사용: node scripts/qa/dev_server.mjs [port] [로컬DB이름]
//
// 환경변수를 셸 앞에 붙이지 않고 이 안에서 세팅한다(에이전트 셸이 env 접두사 형태를
// 막는 경우가 있다). Next 는 이미 설정된 process.env 값을 .env.local 로 덮지 않으므로
// 여기서 넣은 값이 이긴다.
import http from 'node:http'
import next from 'next'

const port = Number(process.argv[2] || 3999)
const dbName = process.argv[3] || 'ipjuhae_e2e'

if (!/^ipjuhae_(e2e|local|test)[a-z0-9_]*$/.test(dbName)) {
  console.error(`거부: 로컬 검증용 DB 이름만 허용한다 (받은 값: ${dbName})`)
  process.exit(1)
}

process.env.DATABASE_URL = `postgresql://${process.env.USER}@localhost:5432/${dbName}`
process.env.DB_SCHEMA = 'ipjuhae'
process.env.JWT_SECRET ||= 'qa-local-only-not-a-real-secret'

const app = next({ dev: true, dir: process.cwd() })
await app.prepare()
const handle = app.getRequestHandler()

http
  .createServer((req, res) => handle(req, res))
  .listen(port, '127.0.0.1', () => {
    console.log(`QA dev server ready: http://127.0.0.1:${port}`)
  })
