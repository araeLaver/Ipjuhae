import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateOmakaseImageText, generateOmakaseText } from '@/lib/ai-omakase'

describe('ai-omakase', () => {
  const fixtureValue = ['unit', 'fixture', 'value'].join('-')
  let originalApiKey: string | undefined
  let originalBaseUrl: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.AI_OMAKASE_API_KEY
    originalBaseUrl = process.env.AI_OMAKASE_BASE_URL
    process.env.AI_OMAKASE_API_KEY = fixtureValue
    process.env.AI_OMAKASE_BASE_URL = 'http://example.test:11115'
  })

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.AI_OMAKASE_API_KEY
    else process.env.AI_OMAKASE_API_KEY = originalApiKey
    if (originalBaseUrl === undefined) delete process.env.AI_OMAKASE_BASE_URL
    else process.env.AI_OMAKASE_BASE_URL = originalBaseUrl
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends text requests to the omakase LLM endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'hello world' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateOmakaseText('question', 0.2)

    expect(result).toBe('hello world')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] || []
    expect(url).toBe('http://example.test:11115/llm/v1/chat/completions')
    expect((init as RequestInit).method).toBe('POST')
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('Authorization')).toBe(['Bearer', fixtureValue].join(' '))
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      input: 'question',
      temperature: 0.2,
    })
  })

  it('sends image requests to the omakase image analyze endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'ocr result' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateOmakaseImageText(
      Buffer.from('fake'),
      'sample.png',
      'extract text',
      0.3,
    )

    expect(result).toBe('ocr result')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] || []
    expect(url).toBe('http://example.test:11115/ocr/api/image/analyze')
    expect((init as RequestInit).method).toBe('POST')
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('Authorization')).toBe(['Bearer', fixtureValue].join(' '))
    const body = (init as RequestInit).body as FormData
    expect(body.get('prompt')).toBe('extract text')
    expect(body.get('temperature')).toBe('0.3')
    expect(body.get('image')).toBeInstanceOf(File)
  })
})
