import { build } from 'esbuild'
await build({ entryPoints: ['lib/ops-deadman.ts'], outfile: 'build/ops-deadman.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs', packages: 'external' })
