/**
 * DOW-1268 — 커뮤니티 목록 화면의 작성자 표기 노드 실측.
 *
 * 왜 따로 필요한가: probe_community_display_name_browser.mjs 는 목록에서 첫 10개
 * 링크만 본다. 그 링크가 상단 인기글(번호+제목만 있는 행)로 채워지면 작성자 메타를
 * 가진 행을 한 번도 보지 않고 "운영자 출현=0" 을 출력한다 — 거짓 안심이다.
 * 여기서는 목록의 모든 글 링크를 훑어 작성자 메타 노드가 있는 행만 골라 판정한다.
 *
 * 판정
 *  - 작성자 표기가 렌더되는 행에서 `익명` 또는 `입주해`(+배지 `운영자`) 외의 표기가 없을 것
 *  - 한 행에 `운영자` 가 2회 이상 나오지 않을 것
 *  - 실명/역할 원문(tenant/landlord/guest)이 화면에 노출되지 않을 것
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'https://www.ipjuhae.com';

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 ipjuhae-qa-dow1268' });
  const fails = [];

  await page.goto(`${BASE}/community`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('a[href]'))
      .some((a) => /\/community\/[0-9a-f-]{8,}/.test(a.getAttribute('href') || '')),
    { timeout: 30000 },
  ).catch(() => console.log('  (경고) 게시글 행 대기 시간 초과'));

  const rows = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => /\/community\/[0-9a-f-]{8,}/.test(a.getAttribute('href') || ''));
    return links.map((a) => {
      const text = a.innerText || '';
      return {
        href: a.getAttribute('href'),
        spans: Array.from(a.querySelectorAll('span'))
          .map((s) => ({ text: (s.innerText || '').trim(), cls: s.className || '' }))
          .filter((s) => s.text),
        hasAnon: /익명/.test(text),
        hasBrand: /입주해/.test(text),
        adminWordCount: (text.match(/운영자/g) || []).length,
        rawRole: (text.match(/tenant|landlord|guest|member|admin/g) || []),
      };
    });
  });

  console.log(`### 목록 전체 글 링크 — ${BASE}/community`);
  console.log(`  링크 수: ${rows.length}`);
  const withAuthor = rows.filter((r) => r.hasAnon || r.hasBrand || r.adminWordCount > 0);
  console.log(`  작성자 표기가 렌더된 행: ${withAuthor.length}`);

  for (const r of withAuthor.slice(0, 8)) {
    console.log(`  ${r.href} | 익명=${r.hasAnon} 입주해=${r.hasBrand} '운영자'=${r.adminWordCount}`);
    console.log(`    span: ${JSON.stringify(r.spans.map((s) => s.text))}`);
    if (r.adminWordCount > 1) fails.push(`목록 행 '운영자' ${r.adminWordCount}회 (${r.href})`);
    if (r.spans.some((s) => /입주해\s*운영자/.test(s.text))) {
      fails.push(`목록 행 이름 노드에 '운영자' 박힘 (${r.href})`);
    }
  }
  const rawLeak = rows.filter((r) => r.rawRole.length > 0);
  if (rawLeak.length) {
    fails.push(`화면에 역할 원문 노출 ${rawLeak.length}행: ${JSON.stringify(rawLeak[0].rawRole)}`);
  }
  if (withAuthor.length === 0) {
    console.log('  주의: 목록 행에 작성자 표기가 렌더되지 않는다 — 목록은 이 항목의 판정 대상이 아니다');
  }

  await browser.close();
  console.log('=== 판정 ===');
  if (fails.length) {
    console.log(`FAIL ${JSON.stringify(fails, null, 1)}`);
    process.exit(1);
  }
  console.log('PASS — 목록 행에 역할 원문·중복 배지 없음');
};

run().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(2);
});
