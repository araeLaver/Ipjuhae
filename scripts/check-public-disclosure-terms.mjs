#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_FILES = [
  'docs/modoo-startup-feature-improvement-plan-20260723.md',
  'docs/modoo-startup-patent-technical-implementation-plan-20260726.md',
]

const TERMS = [
  { term: '특허 등록', replacement: '출원일 확보 및 정규출원 보강 중' },
  { term: '자동 계약조건 확정', replacement: '거래조건 협의 참고값' },
  { term: '계약 가능성 보장', replacement: '계약 전 확인 항목 정리' },
  { term: '법률 보장', replacement: '계약 전 확인자료 검토 보조' },
  { term: '전세사기 방지 보장', replacement: '정보 비대칭 완화 및 추가 확인 질문 제안' },
  { term: '원본 서류 공개', replacement: '원본 대신 필요한 확인 항목 공개' },
  { term: '무단 스크래핑', replacement: '사용자 동의 기반 조회 또는 공식 API 연동 검토' },
  { term: '신용평가', replacement: '검증 기반 신뢰 참고값' },
  { term: '법률 검토 완료', replacement: '법률/개인정보 전문가 검토 예정 또는 반영 예정' },
  { term: '세부 산식', replacement: '대외 공개 제외' },
  { term: '임계값', replacement: '대외 공개 제외' },
  { term: 'OCR prompt 전문', replacement: '대외 공개 제외' },
  { term: 'API key', replacement: '대외 공개 제외' },
  { term: 'SQL', replacement: '대외 공개 제외' },
]

const ALLOWED_CONTEXT_PATTERNS = [
  /금지/,
  /대체/,
  /표현하지 않는다/,
  /복사하지 않는다/,
  /아닌/,
  /오인/,
  /제공하지/,
  /제한한다/,
  /제외/,
  /제거/,
  /공개통제/,
  /체크리스트/,
  /내부 실행계획/,
  /외부 제출 전/,
]

const EXTENSIONS = new Set(['.md', '.txt'])

function collectFiles(targets) {
  const files = []

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      throw new Error(`파일을 찾을 수 없습니다: ${target}`)
    }

    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) {
        files.push(...collectFiles([path.join(target, entry)]))
      }
      continue
    }

    if (EXTENSIONS.has(path.extname(target))) {
      files.push(target)
    }
  }

  return files
}

function isAllowedContext(line, heading) {
  return ALLOWED_CONTEXT_PATTERNS.some((pattern) => pattern.test(line) || pattern.test(heading))
}

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const findings = []
  let heading = ''

  lines.forEach((line, index) => {
    if (/^#{1,6}\s+/.test(line)) {
      heading = line
    }

    for (const { term, replacement } of TERMS) {
      if (!line.includes(term)) {
        continue
      }

      if (isAllowedContext(line, heading)) {
        continue
      }

      findings.push({
        filePath,
        line: index + 1,
        term,
        replacement,
        text: line.trim(),
      })
    }
  })

  return findings
}

function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : DEFAULT_FILES
  const files = collectFiles(targets)
  const findings = files.flatMap(scanFile)

  if (findings.length === 0) {
    console.log(`공개자료 표현 점검 통과: ${files.length}개 파일`)
    return
  }

  console.error(`공개자료 표현 점검 실패: ${findings.length}건`)
  for (const finding of findings) {
    console.error(
      `${finding.filePath}:${finding.line} "${finding.term}" -> ${finding.replacement}\n  ${finding.text}`,
    )
  }
  process.exit(1)
}

main()
