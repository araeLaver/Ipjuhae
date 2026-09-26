# 공개통계 원문 확보 스크립트

지원사업 신청서에 쓰는 **국내 공개통계를 원문에서 직접 대조**하기 위한 스크립트다.
WebSearch/WebFetch가 막혀 있어도 `python3` 표준 라이브러리만으로 동작한다.

## 왜 필요한가

국토교통부 통계를 받으려고 할 때 아래 경로는 **전부 막힌다**.

- `www.molit.go.kr` → 리디렉션 루프(curl exit 47)
- KOSIS 통계표 화면 → AJAX 렌더링이라 HTML에 숫자가 없다
- e-나라지표 / 통계누리 검색 → 같은 이유
- 언론 기사 → 애초에 신청서 출처로 쓸 수 없다

**우회 경로: 정책브리핑(korea.kr) 보도자료 첨부 PDF.** 서버 렌더링이고 인증키가 필요 없다.
국토교통부 월간 「주택 통계」 보도자료 첨부 PDF에는 지역별(전국/수도권/서울/지방)·
임차유형별(전세/월세)·누계 구분이 한 페이지에 모여 있어, 포털 화면보다 대조 품질이 오히려 높다.

## 사용법

```bash
cd scripts/stats

# 1) 보도자료 검색 → newsId 확보
python3 korea_kr_search.py "주택 통계" 3 2026-01-01 2026-09-26

# 2) 상세 페이지에서 첨부파일 fileId 추출 (hwpx / pdf 2개가 나온다)
python3 korea_kr_fetch.py 156742136

# 3) 첨부 PDF 내려받기
python3 korea_kr_download.py 198344707 /tmp/202512_housing_stats.pdf

# 4) 표 구조를 보존해 텍스트 추출 (-layout 필수)
pdftotext -layout /tmp/202512_housing_stats.pdf /tmp/out.txt
```

`probe_molit.py` 는 실거래가 공개시스템 차트 API(`rt.molit.go.kr/pt/main/chart.do`) 확인용이다.
**이 API의 원자료 단위는 천 건이라 월별 반올림 오차가 누적된다** — 교차검증에만 쓰고,
신청서에 적는 값은 보도자료 원문 수치를 쓴다.

`probe_sources.py` 는 접근 가능/불가 경로를 기록해 둔 탐색 스크립트다.
서울 열린데이터광장 `tbLnOpendataRentV` 는 전세/월세 구분이 있지만 `sample` 키로는 5행까지만
나오므로 집계에 쓸 수 없다.

## 확보 실적

- `[수치 2]` 2025년 전국 주택 전월세 거래량 2,791,795건 (수도권 1,858,866건)
- `[수치 3]` 2025년 수도권 월세 거래 비중 61.8% (비아파트 73.5%)

출처: 국토교통부 「'25년 12월 주택통계」 (2026-01-30 석간), `newsId=156742136`.
사용 맥락은 `docs/business-development/20260926_gvalley_cmo_supplement.md` 1장 참조.
