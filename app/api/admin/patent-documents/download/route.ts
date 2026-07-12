import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const PATENT_DOC_ROOT = path.join(
  process.cwd(),
  'docs',
  '\uC131\uB0A8\uC0B0\uC5C5\uC9C4\uD765\uC6D0\u005F\uBAA8\uB450\uC758\uCC3D\uC5C5',
  '260711',
  '\uAE30\uC728\uBC95\uBB34\uBC95\uC778'
)

function getContentType(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case '.txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function isAllowed(baseRoot: string, requested: string) {
  const full = path.resolve(baseRoot, requested)
  const rel = path.relative(baseRoot, full)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const encodedPath = url.searchParams.get('path')

  if (!encodedPath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const decodedPath = decodeURIComponent(encodedPath)
  if (!isAllowed(PATENT_DOC_ROOT, decodedPath)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 })
  }

  const absolutePath = path.resolve(PATENT_DOC_ROOT, decodedPath)

  try {
    const data = await fs.readFile(absolutePath)
    const ext = path.extname(absolutePath).toLowerCase()
    const filename = path.basename(absolutePath)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(data, {
      headers: {
        'Content-Type': getContentType(ext),
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'file not found' }, { status: 404 })
  }
}
