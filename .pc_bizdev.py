import json, os, urllib.request, urllib.error

U = os.environ['PAPERCLIP_API_URL']
K = os.environ['PAPERCLIP_API_KEY']
RID = os.environ.get('PAPERCLIP_RUN_ID', '')
ME = os.environ['PAPERCLIP_AGENT_ID']
CO = os.environ['PAPERCLIP_COMPANY_ID']


def req(path, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json',
         'X-Paperclip-Run-Id': RID}
    r = urllib.request.Request(U + path, data=data, method=method, headers=h)
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'_error': e.code, '_body': e.read().decode()[:800]}


if __name__ == '__main__':
    d = req('/api/issues/DOW-1034/documents/review-draft')
    b = d['body']
    checks = [
        ('rev', '%s / %s' % (d['latestRevisionNumber'], d['latestRevisionId'])),
        ('header-ok', '(v1은 2026-09-12, v2 정합성 검토' in b),
        ('sender-title-ok', '입주해 운영팀 [보드 확정 발신자 실명]' in b),
        ('retention-90d-ok', '최대 90일 동안만 보관' in b),
        ('board-3-ok', '남은 보드 결정 항목 (외부 실행 전 필수) — 3건' in b),
        ('kit-link-ok', 'officetel-validation-facilitator-kit-20260920.md' in b),
        ('old-bracket-sender-gone', '[보드 확정 발신자 이름/대외 직함]' not in b),
        ('old-bracket-retention-gone', '[보드 확정 보관 기간]' not in b),
        ('email-bracket-kept', '[보드 확정 회신 이메일]' in b),
    ]
    for k, v in checks:
        print(k, '=', v)
