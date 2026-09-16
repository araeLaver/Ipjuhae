-- 공인중개사 계정 허용
--
-- users.user_type 제약이 tenant/landlord/admin만 받아서 중개사 계정을 만들 수 없었다.
-- 그런데 제품 코드 18개 파일(트러스트 카드, 동의·공시, 조직 멤버십, 계약 리포트,
-- 신뢰 엔진, 커뮤니티)은 이미 'broker'를 전제로 동작한다. 계정만 못 만드는 상태였다.
--
-- 용어는 'broker'로 통일한다. 랜딩 폼에만 쓰이던 'agent'는 코드에서 걷어낸다 —
-- 'agent'는 "대리인"으로도 읽혀 임대인의 대리인과 혼동된다.
-- waitlist에 'agent'로 저장된 행은 없어 옮길 데이터는 없다.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;

ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('tenant', 'landlord', 'broker', 'admin'));
