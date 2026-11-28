import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let dir: string
let mod: any

beforeAll(async () => {
  const { build } = await import('esbuild')
  dir = mkdtempSync(join(process.cwd(), 'node_modules/.qa-mobile-candidates-'))
  await build({
    entryPoints: ['mobile/src/lib/depositCandidates.ts'],
    bundle: true,
    format: 'esm',
    outdir: dir,
  })
  mod = await import(pathToFileURL(join(dir, 'depositCandidates.js')).href)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('Mobile deposit candidate comparison store', () => {
  it('adds, deduplicates identical inputs, caps at 5, and ranks safest candidate', () => {
    let list = mod.parseSavedCandidates(null)
    expect(list).toEqual([])

    list = mod.addDepositCandidate(list, {
      label: '역삼동 A',
      marketPriceManwon: 40000,
      depositManwon: 32000,
      mortgageMaxManwon: 5000,
      priorDepositsManwon: 0,
      level: 'danger',
      burdenRatio: 0.925,
      auctionCushionManwon: -9000,
    })
    list = mod.addDepositCandidate(list, {
      label: '선릉 B',
      marketPriceManwon: 50000,
      depositManwon: 25000,
      mortgageMaxManwon: 0,
      priorDepositsManwon: 0,
      level: 'safe',
      burdenRatio: 0.5,
      auctionCushionManwon: 10000,
    })

    // Duplicate exact numbers replaces old entry instead of growing list
    list = mod.addDepositCandidate(list, {
      label: '선릉 B (메모 수정)',
      marketPriceManwon: 50000,
      depositManwon: 25000,
      mortgageMaxManwon: 0,
      priorDepositsManwon: 0,
      level: 'safe',
      burdenRatio: 0.5,
      auctionCushionManwon: 10000,
    })
    expect(list).toHaveLength(2)
    expect(mod.pickSafestCandidate(list).label).toBe('선릉 B (메모 수정)')

    // Cap at MAX_SAVED_CANDIDATES (5)
    for (let i = 0; i < 6; i++) {
      list = mod.addDepositCandidate(list, {
        label: `후보 ${i}`,
        marketPriceManwon: 30000 + i * 1000,
        depositManwon: 20000,
        mortgageMaxManwon: 0,
        priorDepositsManwon: 0,
        level: 'caution',
        burdenRatio: 0.65,
        auctionCushionManwon: 1000,
      })
    }
    expect(list).toHaveLength(5)

    // Remove by id
    const firstId = list[0].id
    list = mod.removeDepositCandidate(list, firstId)
    expect(list).toHaveLength(4)
  })
})
