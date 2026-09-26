// 로컬 QA 계정으로 로그인하여 실제 메시지 API의 상대 역할을 검증한다.
// 사전 조건: QA 계정과 QA_OTHER_USER_ID 사이에 대화방이 있어야 한다.
import assert from 'node:assert/strict'

const base = process.env.QA_API_URL || 'http://127.0.0.1:3007/api'
const url = new URL(base)
assert(['localhost', '127.0.0.1'].includes(url.hostname), '로컬 QA API만 허용합니다')
const { QA_EMAIL, QA_PASSWORD, QA_OTHER_USER_ID, QA_EXPECTED_ROLE } = process.env
assert(QA_EMAIL && QA_PASSWORD && QA_OTHER_USER_ID && QA_EXPECTED_ROLE,
  'QA_EMAIL, QA_PASSWORD, QA_OTHER_USER_ID, QA_EXPECTED_ROLE이 필요합니다')

const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
})
assert.equal(login.status, 200, 'QA 계정 로그인 실패')
const cookie = login.headers.getSetCookie()
  .map(value => value.split(';')[0])
  .find(value => value.startsWith('auth_token='))
assert(cookie, '인증 cookie가 없습니다')

let found = false
for (let page = 1; ; page++) {
  const response = await fetch(`${base}/messages/conversations?limit=50&page=${page}`, {
    headers: { Cookie: cookie },
  })
  assert.equal(response.status, 200, '대화 목록 조회 실패')
  const result = await response.json()
  for (const conversation of result.conversations) {
    if (conversation.other_user_id !== QA_OTHER_USER_ID) continue
    found = true
    assert.equal(conversation.other_user_type, QA_EXPECTED_ROLE,
      '대화 상대의 실제 계정 역할과 API 역할이 다릅니다')
  }
  if (page >= result.pagination.totalPages) break
}
assert(found, '검증할 대화방이 없습니다')
console.log('통과: 메시지 API가 기대한 상대 역할을 반환합니다')
