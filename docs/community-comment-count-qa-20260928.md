# 공개 댓글 수 일치 검증 — 2026-09-28

DOW-1274: 목록·상세·홈 조회의 작성 누계 `p.comment_count`를 현재 공개 댓글 집계로 교체했다.
`deleted_at IS NULL AND hidden_at IS NULL` 조건은 댓글 API의 total과 동일하다.
`COUNT(*)::int`로 JSON 숫자 타입을 유지한다. 역할 라벨과 신고 처리 경로는 변경하지 않았다.

## 재현과 수정 후 대조

실제 GET 핸들러와 `getHomeContent()`를 호출하고 DB 접근만 동일 PostgreSQL 연결로 연결했다.
로컬 PostgreSQL `ipjuhae_db`의 단일 트랜잭션에 `pg_temp` 테이블을 만들고 종료 시 롤백한다.
운영 DB, 기존 로컬 데이터, 계정 자격증명은 변경하지 않는다.

| 상태 | 수정 전 목록/상세/홈/댓글 total | 수정 후 |
| --- | --- | --- |
| 공개 댓글 2개 | 2 / 2 / 2 / 2 | 2 / 2 / 2 / 2 |
| 1개 숨김 | 2 / 2 / 2 / 1 (테스트 실패) | 1 / 1 / 1 / 1 |
| 나머지 댓글 삭제 | 미실행 | 0 / 0 / 0 / 0 |
| 숨김 댓글 복원 | 미실행 | 1 / 1 / 1 / 1 |
| 복원 댓글 삭제 | 미실행 | 0 / 0 / 0 / 0 |

다른 글의 공개 댓글 1개는 모든 단계에서 그대로 1개다. 수정 전 동일 테스트가 실패함을 먼저
확인한 뒤 코드를 수정했다. 저장된 comment_count는 2로 유지하므로 집계가 다시 누계를
참조하면 테스트가 실패한다. HTTP 서버/브라우저 경유 검증은 아직 하지 않았다.

## 실행

```sh
QA_DATABASE_URL="postgresql://${USER}@localhost:5432/ipjuhae_db" npx vitest run __tests__/api/community-count-db.test.ts
```

`QA_DATABASE_URL`이 없으면 이 실DB 테스트는 건너뛴다. 비로컬 주소는 거부한다.

- 실DB 및 인접 회귀: 4개 파일, 24개 테스트 통과.
- 전체 테스트: 85개 파일 통과, 2개 파일 건너뜀; 902개 통과, 8개 건너뜀.
- `npm run typecheck`: 통과.
- 기존 익명화/홈 역할 테스트의 DB 대역이 서브쿼리를 주 쿼리로 오인하는 부분을 보완했다.
- 기존 `idx_community_comments_post(post_id, created_at) WHERE deleted_at IS NULL` 인덱스가 있다.
  별도 인덱스·마이그레이션은 추가하지 않았다. 대규모 데이터 성능 실측은 이번 범위 밖이다.

QA 독립 재검증과 화면 숫자·0건 표시 검토 후 배포를 판단한다. 이번 작업에서 push·배포하지 않았다.
