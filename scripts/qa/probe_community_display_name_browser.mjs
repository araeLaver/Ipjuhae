/**
 * DOW-1249 / DOW-1236 — 프로덕션 운영자 표시 이름 브라우저 실측.
 *
 * 왜 브라우저인가: `/community` 는 클라이언트 렌더라서 HTML fetch 로는 게시글 행을
 * 잡을 수 없다(SSR 응답은 "아직 질문이 없어요" 스켈레톤이다). 또 payload 에는 표시
 * 이름 필드가 없고 클라이언트가 `author_role` 로 만들어 내므로, 이 항목만은 렌더된
 * DOM 을 봐야 판정이 된다.
 *
 * 왜 innerText 정규식이 아니라 노드별 추출인가: 의도한 화면은 이름 `입주해` 다음에
 * 배지 `운영자` 가 **따로** 붙은 것이다. innerText 는 둘을 공백으로 이어 붙여
 * `입주해 운영자` 로 만들기 때문에, 문구 검색으로는 "이름에 운영자가 박힌 결함"과
 * "정상 이름+배지"를 구분할 수 없다(실제로 거짓 FAIL 이 났다).
 *
 * 판정
 *  - 작성자 메타 줄에서 이름 노드 텍스트가 정확히 `입주해` 여야 한다
 *  - 배지 노드가 따로 있고 텍스트가 `운영자` 여야 한다
 *  - 메타 줄 전체에서 `운영자` 는 정확히 1회여야 한다
 *
 * 개인정보는 출력하지 않는다. 역할에서 만들어진 표기 문자열과 카운트만 남긴다.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'https://www.ipjuhae.com';

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 ipjuhae-qa-dow1249' });
  const fails = [];

  // networkidle 은 이 페이지에서 끝나지 않는다(상시 요청). 조건 대기로 바꾼다.
  await page.goto(`${BASE}/community`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('a[href]'))
      .some((a) => /\/community\/[0-9a-f-]{8,}/.test(a.getAttribute('href') || '')),
    { timeout: 30000 },
  ).catch(() => console.log('  (경고) 게시글 행 대기 시간 초과'));

  const list = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => /\/community\/[0-9a-f-]{8,}/.test(a.getAttribute('href') || ''));
    return links.slice(0, 10).map((a) => {
      const badges = Array.from(a.querySelectorAll('span')).map((s) => (s.innerText || '').trim());
      return {
        href: a.getAttribute('href'),
        spans: badges.filter(Boolean),
        adminWordCount: ((a.innerText || '').match(/운영자/g) || []).length,
      };
    });
  });

  console.log(`### 커뮤니티 목록 (브라우저 렌더) — ${BASE}/community`);
  console.log(`  게시글 행 수: ${list.length}`);
  for (const row of list.slice(0, 4)) {
    console.log(`  행 span 텍스트: ${JSON.stringify(row.spans)} | '운영자' 출현=${row.adminWordCount}`);
    if (row.spans.some((s) => /입주해\s*운영자/.test(s))) {
      fails.push(`목록: 이름 노드 자체에 '운영자'가 박혀 있음 (${row.href})`);
    }
    if (row.adminWordCount > 1) fails.push(`목록 행에 '운영자' ${row.adminWordCount}회 (${row.href})`);
  }
  if (list.length === 0) fails.push('목록에 게시글 행이 렌더되지 않음 — 실측 불가');

  if (list.length > 0) {
    const href = list[0].href;
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
      () => !!document.querySelector('h1') && document.querySelectorAll('span').length > 2,
      { timeout: 30000 },
    ).catch(() => console.log('  (경고) 상세 렌더 대기 시간 초과'));

    const detail = await page.evaluate(() => {
      // 작성자 메타 줄: h1 직전의 flex 행. 이름 span 과 배지 span 이 형제로 들어 있다.
      const h1 = document.querySelector('h1');
      let meta = null;
      if (h1) {
        let prev = h1.previousElementSibling;
        while (prev && !(prev.className || '').includes('flex')) prev = prev.previousElementSibling;
        meta = prev;
      }
      if (!meta) return { found: false };
      const spans = Array.from(meta.querySelectorAll('span')).map((s) => ({
        text: (s.innerText || '').trim(),
        cls: s.className || '',
      })).filter((s) => s.text);
      return {
        found: true,
        spans,
        adminWordCount: ((meta.innerText || '').match(/운영자/g) || []).length,
      };
    });

    console.log(`### 글 상세 (브라우저 렌더) — ${href}`);
    if (!detail.found) {
      fails.push('상세: 작성자 메타 줄을 찾지 못함 — 실측 불가');
      console.log('  메타 줄 미발견');
    } else {
      for (const s of detail.spans) {
        const kind = s.cls.includes('bg-primary') ? '배지(bg-primary)'
          : s.cls.includes('bg-secondary') ? '대상 라벨'
          : '텍스트';
        console.log(`  ${kind}: "${s.text}"`);
      }
      console.log(`  메타 줄 '운영자' 출현: ${detail.adminWordCount} (1이어야 통과)`);

      const nameSpan = detail.spans.find((s) => !s.cls.includes('bg-primary') && !s.cls.includes('bg-secondary'));
      const badgeSpan = detail.spans.find((s) => s.cls.includes('bg-primary'));

      if (!nameSpan) fails.push('상세: 이름 노드 없음');
      else if (nameSpan.text !== '입주해') fails.push(`상세: 이름 노드가 '입주해'가 아님 → "${nameSpan.text}"`);
      if (!badgeSpan) fails.push("상세: 운영자 배지 노드가 사라짐 (DOW-1176 강조 취지 훼손)");
      else if (badgeSpan.text !== '운영자') fails.push(`상세: 배지 텍스트가 '운영자'가 아님 → "${badgeSpan.text}"`);
      if (detail.adminWordCount !== 1) fails.push(`상세: 메타 줄 '운영자' 출현이 ${detail.adminWordCount}회`);
    }
  }

  await browser.close();

  console.log('=== 판정 ===');
  if (fails.length) {
    console.log(`FAIL ${JSON.stringify(fails, null, 1)}`);
    process.exit(1);
  }
  console.log('PASS — 이름 `입주해` + 배지 `운영자` 분리, 메타 줄 중복 없음');
};

run().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(2);
});
