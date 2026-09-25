#!/bin/bash
# DOW-1173: 비운영 QA 환경 공통 값. CEO 승인 범위(로컬 DB + 로컬 endpoint).
#
# 포트를 3000으로 쓰면 안 된다 — 이 머신에는 다른 앱이 127.0.0.1:3000을 이미 점유하고
# 있고(`/office`로 리다이렉트하는 별개 프로젝트), 에뮬레이터의 10.0.2.2는 호스트 loopback에
# 매핑되므로 **앱이 조용히 남의 백엔드에 붙는다.** 실제로 한 번 그 상태를 관측했다.
export QA_PORT=3007
export QA_API_BASE="http://10.0.2.2:${QA_PORT}/api"

export DATABASE_URL="postgresql://${USER}@localhost:5432/ipjuhae_db"
export DB_SCHEMA=ipjuhae
export NODE_ENV=development
