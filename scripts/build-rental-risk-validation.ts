import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { evaluateMatchingQuality, matchComplex, type ComplexRecord, type RiskBriefInput } from '../lib/rental-risk'

const SOURCE_COMMIT = '63056a50edfd3057129a5f28f79046f626195a53'
const SOURCE_URL = `https://raw.githubusercontent.com/Indongspace/mulcamp_Mini_project_Final/${SOURCE_COMMIT}/%EC%84%9C%EC%9A%B8%EC%A0%84%EC%B2%B4/df_%EC%84%9C%EC%9A%B8.csv`
const SNAPSHOT_PATH = resolve('fixtures/rental-risk-public-validation.csv')
const REPORT_PATH = resolve('docs/rental-risk-validation-results.json')

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += character
  }
  cells.push(cell)
  return cells
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function parcelNumber(main: string, sub: string): string {
  const normalizedMain = String(Number(main))
  return Number(sub) > 0 ? `${normalizedMain}-${Number(sub)}` : normalizedMain
}

async function getSource(): Promise<string> {
  const localSource = process.argv[2]
  if (localSource) return readFile(resolve(localSource), 'utf8')
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`공개 CSV 다운로드 실패: HTTP ${response.status}`)
  return response.text()
}

async function main() {
const source = await getSource()
const [headerLine, ...lines] = source.replace(/^\uFEFF/, '').split(/\r?\n/)
const headers = parseCsvLine(headerLine)
const column = (name: string) => {
  const index = headers.indexOf(name)
  if (index < 0) throw new Error(`필수 컬럼 없음: ${name}`)
  return index
}

const indexes = {
  districtCode: column('자치구코드'), district: column('자치구명'), dongCode: column('법정동코드'),
  dong: column('법정동명'), main: column('본번'), sub: column('부번'), name: column('건물명'),
  area: column('건물면적(㎡)'), buildingUse: column('건물용도'), contractDate: column('계약일'),
}

const seen = new Set<string>()
const bases = lines.flatMap((line) => {
  if (!line) return []
  const row = parseCsvLine(line)
  if (row[indexes.buildingUse] !== '아파트' || !row[indexes.name] || !row[indexes.main]) return []
  const id = `${row[indexes.districtCode]}-${row[indexes.dongCode]}-${parcelNumber(row[indexes.main], row[indexes.sub])}-${row[indexes.name]}`
  if (seen.has(id)) return []
  seen.add(id)
  return [{
    id,
    district: row[indexes.district],
    dong: row[indexes.dong],
    parcel: parcelNumber(row[indexes.main], row[indexes.sub]),
    name: row[indexes.name],
    areaM2: Number(row[indexes.area]),
    contractDate: row[indexes.contractDate],
  }]
}).slice(0, 100)

if (bases.length !== 100) throw new Error(`고유 아파트 100건이 필요하지만 ${bases.length}건만 확보됨`)

const cases = bases.map((base, index) => {
  const canonicalAddress = `서울 ${base.district} ${base.dong} ${base.parcel}`
  const alias = `${base.name.replace(/아파트/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '')}별칭`
  let category = 'exact'
  let inputAddress = canonicalAddress
  let inputName = base.name
  if (index >= 25 && index < 45) {
    category = 'normalization_whitespace'
    inputAddress = ` 서울  ${base.district}  ${base.dong}  ${base.parcel} `
  } else if (index >= 45 && index < 60) {
    category = 'normalization_apartment_suffix'
    inputName = `${base.name}아파트`
  } else if (index >= 60 && index < 70) {
    category = 'normalization_parenthetical'
    inputName = `${base.name}(공개CSV)`
  } else if (index >= 70 && index < 80) {
    category = 'alias'
    inputName = alias
  } else if (index >= 80 && index < 90) {
    category = 'missing_city'
    inputAddress = `${base.district} ${base.dong} ${base.parcel}`
  } else if (index >= 90) {
    category = 'missing_legal_dong'
    inputAddress = `서울 ${base.district} ${base.parcel}`
  }
  return { ...base, canonicalAddress, alias, category, inputAddress, inputName }
})

const complexes: ComplexRecord[] = cases.map((item) => ({
  complexId: item.id,
  parcelAddress: item.canonicalAddress,
  roadAddress: '',
  complexName: item.name,
  aliases: [item.alias],
}))

const evaluated = cases.map((item) => {
  const input: RiskBriefInput = {
    address: item.inputAddress, complexName: item.inputName, areaM2: item.areaM2,
    depositManwon: 0, monthlyRentManwon: 0,
  }
  const match = matchComplex(input, complexes)
  return { ...item, matchedComplexId: match.complex?.complexId ?? null, matchGrade: match.grade, matchMethod: match.method }
})

const quality = evaluateMatchingQuality(evaluated.map((item) => ({
  expectedComplexId: item.id,
  matchedComplexId: item.matchedComplexId,
})))
const categoryResults = Object.fromEntries([...new Set(evaluated.map((item) => item.category))].map((category) => {
  const rows = evaluated.filter((item) => item.category === category)
  const matched = rows.filter((item) => item.matchedComplexId === item.id).length
  return [category, { total: rows.length, matched, rate: matched / rows.length }]
}))

const snapshotHeader = ['case_id', 'source_row_id', 'category', 'canonical_address', 'canonical_name', 'input_address', 'input_name', 'expected_complex_id', 'matched_complex_id', 'match_grade', 'match_method', 'area_m2', 'contract_date']
const snapshotRows = evaluated.map((item, index) => [
  index + 1, item.id, item.category, item.canonicalAddress, item.name, item.inputAddress, item.inputName,
  item.id, item.matchedComplexId ?? '', item.matchGrade, item.matchMethod, item.areaM2, item.contractDate,
])
await mkdir(dirname(SNAPSHOT_PATH), { recursive: true })
await writeFile(SNAPSHOT_PATH, [snapshotHeader, ...snapshotRows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n')

const report = {
  generatedAt: new Date().toISOString(),
  source: { url: SOURCE_URL, commit: SOURCE_COMMIT, sha256: createHash('sha256').update(source).digest('hex'), license: 'MIT (source repository)' },
  sample: { total: evaluated.length, uniqueComplexes: complexes.length, selection: '원천 CSV 순서상 최초 100개 고유 아파트' },
  metrics: { precision: quality.precision, coverage: quality.coverage, insufficientRate: evaluated.filter((item) => item.matchGrade === 'insufficient').length / evaluated.length, go: quality.go },
  categoryResults,
  failures: {
    addressNormalization: evaluated.filter((item) => item.category === 'missing_city' && !item.matchedComplexId).length,
    legalDongExpansion: evaluated.filter((item) => item.category === 'missing_legal_dong' && !item.matchedComplexId).length,
    alias: evaluated.filter((item) => item.category === 'alias' && !item.matchedComplexId).length,
    missing: 0,
  },
  expansionSuccessRate: {
    definition: 'exact 입력을 제외한 normalization·alias 변형 55건 중 자동 매칭 성공 비율',
    value: evaluated.slice(25, 80).filter((item) => item.matchedComplexId === item.id).length / 55,
  },
}
await mkdir(dirname(REPORT_PATH), { recursive: true })
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
