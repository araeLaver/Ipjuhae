import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const files = [
  'lib/trust-engine.ts',
  'lib/trust-policy.ts',
  'lib/trust-outbox.ts',
  'lib/idempotency.ts',
  'db/migration-024-patent-trust-engine.sql',
  'db/migration-025-trust-operations.sql',
  'db/migration-026-evidence-fact-cascade.sql',
  'db/migration-027-trust-model-alignment.sql',
  'db/backfill-trust-ledger.ts',
  'app/trust-center/page.tsx',
  'app/admin/trust/page.tsx',
  'app/admin/trust/operations/page.tsx',
  'app/api/v1/evidence/route.ts',
  'app/api/v1/disclosures/decide/route.ts',
  'app/api/v1/transactions/[id]/references/route.ts',
  'app/api/v1/trust/change-events/route.ts',
  'app/api/v1/admin/trust-reviews/route.ts',
  'app/api/v1/external-requests/route.ts',
  'app/api/cron/trust-maintenance/route.ts',
  'app/api/cron/trust-outbox/route.ts',
  'vercel.json',
]

const evidence = []
for (const file of files) {
  const content = await readFile(resolve(file))
  evidence.push({
    path: file.replaceAll('\\', '/'),
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: content.byteLength,
  })
}

const output = 'docs/patent/evidence-manifest.json'
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify({
  schema: 'ipjuhae-patent-evidence-manifest/v1',
  patentApplication: '10-2026-0126389',
  generatedAt: new Date().toISOString(),
  algorithm: 'SHA-256',
  files: evidence,
}, null, 2)}\n`)
console.log(JSON.stringify({ output, files: evidence.length }))

