# 게시 시작 — D1~D3 실행표

원고·디자인은 다 있는데 게시가 0건이라 지표가 안 움직인다. 이 파일은 **읽지 말고 그대로 실행**하는 용도다.
원고 전체는 `posts/`, 이미지는 `exports/`에 있다.

이미지는 `node scripts/export-sns-artboards.mjs`로 다시 뽑을 수 있다.

---

## 0단계 · 프로필 (1회, 약 10분)

`posts/00-profiles.md`의 문구를 세 채널에 그대로 넣는다. **링크의 `utm_source`를 채널마다 다르게 유지해야** 어디서 온 신청인지 구분된다.

| 채널 | 링크 |
| --- | --- |
| 인스타 바이오 | `https://ipjuhae.com/?utm_source=ig_bio` |
| 스레드 | `https://ipjuhae.com/?utm_source=threads` |
| X | `https://ipjuhae.com/?utm_source=x` |

프로필 사진은 세 곳 동일하게. 워드마크 하나면 된다.

---

## D1 · 등기부 뜯어보기 #01

### 인스타그램 — 캐러셀 8장

**첨부 (이 순서 그대로)**

```
exports/Main.png      ← 1/8 표지
exports/Deungi2.png   ← 2/8
exports/Deungi3.png   ← 3/8
exports/Deungi4.png   ← 4/8
exports/Deungi5.png   ← 5/8
exports/Deungi6.png   ← 6/8
exports/Deungi7.png   ← 7/8
exports/Deungi8.png   ← 8/8
```

**본문** — `posts/01-series-deungi.md`의 `#01 · 인스타그램` 블록을 그대로 복사한다.
해시태그까지 포함되어 있다. 링크는 본문에 넣지 않는다(인스타 본문 링크는 눌리지 않는다). 프로필 링크로 보낸다.

### 스레드

**본문** — `posts/01-series-deungi.md`의 `#01 · 스레드` 블록.

이미지는 스레드 전용 아트보드가 아직 없다. **텍스트만 올려도 된다**(스레드는 텍스트 글의 도달이 나쁘지 않다).
이미지를 붙이고 싶으면 `exports/Main.png`를 재사용한다.

### X

**본문** — `posts/01-series-deungi.md`의 `#01 · X` 블록. 6개 연속 트윗이다.
1번 트윗에 `exports/Main.png` 첨부. **링크는 본문이 아니라 마지막 답글에 단다**(본문 링크는 도달이 깎인다).

```
https://ipjuhae.com/?utm_source=x
```

첫 트윗을 올린 뒤 **프로필에 고정**한다.

---

## D2 · 「지수의 계약」 #01

만화는 저장·공유가 가장 잘 되는 형식이다.

- **첨부**: `exports/Comic01.png` 1장
- **본문**: `posts/05-series-comic.md`의 `#01` 캡션
- 채널: 인스타 + 스레드. X는 이미지 1장 + 짧은 문장으로 줄인다

**12화 전편(`exports/Comic01.png` ~ `Comic12.png`)이 다 나와 있다.** 이후 격일로 한 화씩 올리면
24일치 편성이 이미 확보된 셈이다. 원고를 고치면 아래로 다시 생성한다.

```bash
node scripts/generate-comic-artboards.mjs   # 원고 → 아트보드
node scripts/export-sns-artboards.mjs       # 아트보드 → PNG
```

---

## D3 · 임대인 노트 #01

전환 트랙. 도달은 적지만 신청으로 이어지는 쪽이다.

- **첨부**: `exports/Landlord1.png` ~ `Landlord6.png` (6장 캐러셀)
- **본문**: `posts/02-series-landlord.md`의 `#01` 블록

---

## 올리기 전 매번 확인할 것

- 원고에 `⚠︎ 올리기 전 확인` 표시가 있으면 그 항목을 먼저 처리한다. 등기 실무·법률 내용이 들어간 화에 붙어 있다
- 출처 없는 숫자(발급 수수료, "근저당 70%" 같은 기준선)는 넣지 않는다
- 특정 매물·특정인을 단정하는 표현을 쓰지 않는다. 「보증금 못 받습니다」류 단정은 표지에서도 피한다
- 개별 계약의 안전이나 사고 예방을 보장하는 표현을 쓰지 않는다

## 게시 뒤

댓글에 답을 단다. 첫 2주는 **남의 글에 답글 다는 것**이 새 글 올리는 것보다 팔로워를 더 데려온다. 하루 10개, 홍보 링크는 절대 달지 않는다.

## 확인

게시 일주일 뒤 채널별 유입을 본다.

```bash
fly ssh console -a ipjuhae-production -C "node -e \"const{Client}=require('/app/node_modules/pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();await c.query('SET search_path TO ipjuhae, public');const r=await c.query(\\\"SELECT COALESCE(NULLIF(properties->>'utm_source',''),'direct') src, COUNT(*)::int n FROM analytics_events WHERE event_name='page_view' GROUP BY 1 ORDER BY 2 DESC\\\");console.log(r.rows);const w=await c.query('SELECT COUNT(*)::int n FROM waitlist');console.log('waitlist',w.rows);await c.end()})()\""
```

보는 값은 조회수가 아니라 **게시물당 팔로워 증가**와 **채널별 신청 수**다.
