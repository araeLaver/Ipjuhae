// 로컬 QA 계정 4개의 실제 대화 API·DB 역할 계약을 검증한다.
// QA_ACCOUNTS_FILE: { tenant: {id,email,password}, landlord: {...}, broker: {...}, admin: {...} }
// 계정은 사전에 준비한다. 운영 endpoint는 허용하지 않는다.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const base = process.env.QA_API_URL || 'http://127.0.0.1:3007/api'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), '로컬 QA API만 허용합니다')
assert(process.env.QA_ACCOUNTS_FILE, 'QA_ACCOUNTS_FILE이 필요합니다')
const accounts = JSON.parse(await readFile(process.env.QA_ACCOUNTS_FILE, 'utf8'))
async function request(path, cookie, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`)
  return { body: await response.json(), cookie: response.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') }
}
const roles = ['tenant', 'landlord', 'broker', 'admin']
for (const role of roles) {
  const account = accounts[role]
  assert(account?.id && account?.email && account?.password, `${role} 계정 정보가 필요합니다`)
  account.cookie = (await request('/auth/login', null, { email: account.email, password: account.password })).cookie
}
for (let i = 0; i < roles.length; i++) for (let j = i + 1; j < roles.length; j++) {
  const a = accounts[roles[i]], b = accounts[roles[j]]
  const first = (await request('/messages/conversations', a.cookie, { targetUserId: b.id })).body
  const reverse = (await request('/messages/conversations', b.cookie, { targetUserId: a.id })).body
  assert.equal(first.conversationId, reverse.conversationId, '역방향 요청이 같은 대화를 반환해야 합니다')
  for (const [me, other, role] of [[a, b, roles[j]], [b, a, roles[i]]]) {
    let conversation
    for (let page = 1; ; page++) {
      const list = (await request(`/messages/conversations?limit=50&page=${page}`, me.cookie)).body
      conversation = list.conversations.find(x => x.id === first.conversationId)
      if (conversation || page >= list.pagination.totalPages) break
    }
    assert(conversation, '생성한 대화가 목록에 있어야 합니다')
    assert.equal(conversation.other_user_id, other.id)
    assert.equal(conversation.other_user_type, role)
    assert.deepEqual([conversation.landlord_id, conversation.tenant_id].sort(), [me.id, other.id].sort())
    const detail = (await request(`/messages/conversations/${first.conversationId}`, me.cookie)).body
    assert.equal(detail.conversation.otherUser.id, other.id)
    assert.equal(detail.conversation.otherUser.type, role)
  }
  console.log(`통과: ${roles[i]} ↔ ${roles[j]} 생성·재사용·참가자·목록·상세 역할`)
}
