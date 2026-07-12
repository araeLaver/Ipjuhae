import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { promises as fs } from 'node:fs'
import path from 'node:path'

interface PatentDocumentFile {
  id: string
  file_name: string
  relative_path: string
  stage: string
  filing_number: string | null
  filing_date: string | null
  kind: string
  extension: string
  size_bytes: number
  updated_at: string
}

const PATENT_DOC_ROOT = path.join(
  process.cwd(),
  'docs',
  '\uC131\uB0A8\uC0B0\uC5C5\uC9C4\uD765\uC6D0\u005F\uBAA8\uB450\uC758\uCC3D\uC5C5',
  '260711',
  '\uAE30\uC728\uBC95\uBB34\uBC95\uC778'
)

function formatDateFromYmd(value: string): string | null {
  if (!/^\d{6}/.test(value)) return null

  const yy = Number(value.slice(0, 2))
  const mm = value.slice(2, 4)
  const dd = value.slice(4, 6)

  const year = yy >= 60 ? 1900 + yy : 2000 + yy
  const date = new Date(`${year}-${mm}-${dd}`)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

function parseFilingDate(fileName: string): string | null {
  const dashed = fileName.match(/(?:^|[^0-9])(\d{4}-\d{2}-\d{2})(?:$|[_\-.~() ])/)
  if (dashed) return dashed[1]

  const six = fileName.match(/^(\d{6})(?=[_\-.~]|$)/) ?? fileName.match(/[ _\-.~(](\d{6})(?=[_\-.~() ]|$)/)
  const match = six ? six : null
  if (!match) return null
  return formatDateFromYmd(match[1])
}

function parseFilingNumber(fileName: string): string | null {
  const match = fileName.match(/PD[-_]?\d+T?/i)
  return match ? match[0] : null
}

function detectKind(fileName: string): string {
  const name = fileName.toLowerCase()

  if (name.includes('청구서')) return 'claims'
  if (name.includes('특허출원서') || name.includes('특허신청')) return 'patent_application'
  if (name.includes('명세서')) return 'specification'
  if (name.includes('납부확인')) return 'payment_receipt'
  if (name.includes('출원번호통지서')) return 'filing_notice'
  if (name.includes('발명설명자료')) return 'invention_description'
  if (name.includes('기술구성상세서')) return 'technology_spec'
  if (name.includes('서비스엔진')) return 'service_engine'
  return 'document'
}

function deriveStage(relativePath: string): string {
  if (relativePath.includes('임시초안')) return '임시초안'
  if (relativePath.includes('전달문서')) return '전달문서'
  if (relativePath.includes('받은문서')) return '받은문서'
  return 'unclassified'
}

function isAllowedPath(filePath: string): boolean {
  const rel = path.relative(PATENT_DOC_ROOT, filePath)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function collectPatentFiles(): Promise<PatentDocumentFile[]> {
  const stack: string[] = [PATENT_DOC_ROOT]
  const out: PatentDocumentFile[] = []

  while (stack.length > 0) {
    const current = stack.pop()!

    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue
        stack.push(entryPath)
        continue
      }

      if (!entry.isFile()) continue

      const stat = await fs.stat(entryPath)
      const rel = path.relative(PATENT_DOC_ROOT, entryPath)

      if (!isAllowedPath(entryPath)) continue
      if (entry.name.startsWith('~')) continue

      out.push({
        id: Buffer.from(rel).toString('base64url'),
        file_name: entry.name,
        relative_path: rel,
        stage: deriveStage(rel),
        filing_number: parseFilingNumber(entry.name),
        filing_date: parseFilingDate(entry.name),
        kind: detectKind(entry.name),
        extension: path.extname(entry.name).toLowerCase(),
        size_bytes: stat.size,
        updated_at: stat.mtime.toISOString(),
      })
    }
  }

  return out
}

export async function GET() {
  const admin = await getAdminUser()

  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    await fs.access(PATENT_DOC_ROOT)
  } catch {
    return NextResponse.json({ documents: [] })
  }

  try {
    const docs = await collectPatentFiles()

    docs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    return NextResponse.json({ documents: docs })
  } catch (error) {
    return NextResponse.json(
      { error: 'failed_to_read_patent_documents', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}
