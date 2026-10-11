import { build } from 'esbuild'
await build({ entryPoints: ['lib/policy-news-store.ts'], outfile: 'build/policy-news.cjs', bundle: true, platform: 'node', target: 'node20', format: 'cjs', packages: 'external' })
