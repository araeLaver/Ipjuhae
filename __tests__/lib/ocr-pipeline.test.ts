import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

import * as aiOmakase from '@/lib/ai-omakase'
import { extractTextFromDocument } from '@/lib/ocr-pipeline'

describe('ocr pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs a single OCR pass for normal images', async () => {
    const normalImage = await sharp({
      create: {
        width: 160,
        height: 120,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer()

    const file = new File([new Uint8Array(normalImage)], 'normal.png', { type: 'image/png' })
    const spy = vi
      .spyOn(aiOmakase, 'generateOmakaseImageText')
      .mockResolvedValue('매우 긴 추출 텍스트입니다.')

    const result = await extractTextFromDocument(file)

    expect(result).toEqual({
      text: '매우 긴 추출 텍스트입니다.',
      source: 'image',
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('retries OCR on tall images with split chunks', async () => {
    const tallImage = await sharp({
      create: {
        width: 480,
        height: 4200,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer()

    const file = new File([new Uint8Array(tallImage)], 'contract.png', { type: 'image/png' })
    const spy = vi
      .spyOn(aiOmakase, 'generateOmakaseImageText')
      .mockImplementation(async (_image, fileName) => {
        if (fileName.includes('_part_')) {
          return `part text for ${fileName}`
        }
        return '짧음'
      })

    const result = await extractTextFromDocument(file)

    expect(result.source).toBe('image')
    expect(result.text).toContain('part text for contract_part_1.png')
    expect(result.text).toContain('part text for contract_part_2.png')
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.length).toBeGreaterThan(2)
  })
})
