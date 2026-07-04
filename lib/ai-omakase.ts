import { Buffer } from 'node:buffer'

const AUTH_SCHEME = 'Bearer'

function getApiKey(): string | null {
  return process.env.AI_OMAKASE_API_KEY || null
}

function getBaseUrl(): string | null {
  return process.env.AI_OMAKASE_BASE_URL || null
}

function createAuthHeaders(key: string): Headers {
  const headers = new Headers()
  headers.set('Authorization', [AUTH_SCHEME, key].join(' '))
  return headers
}

function getClientConfig(): { baseUrl: string; headers: Headers } {
  const key = getApiKey()
  if (!key) {
    throw new Error('AI Omakase API key is not configured')
  }

  const baseUrl = getBaseUrl()
  if (!baseUrl) {
    throw new Error('AI Omakase base URL is not configured')
  }

  return {
    baseUrl,
    headers: createAuthHeaders(key),
  }
}

function withContentType(headers: Headers, contentType?: string): Headers {
  const nextHeaders = new Headers(headers)
  if (contentType) {
    nextHeaders.set('Content-Type', contentType)
  }
  return nextHeaders
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json()
      return (
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `AI Omakase request failed with status ${response.status}`
      )
    } catch {
      return `AI Omakase request failed with status ${response.status}`
    }
  }

  try {
    const text = await response.text()
    return text.trim() || `AI Omakase request failed with status ${response.status}`
  } catch {
    return `AI Omakase request failed with status ${response.status}`
  }
}

async function parseTextResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null)
    const value = data?.text ?? data?.result ?? data?.output ?? data?.message
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    return JSON.stringify(data ?? {}, null, 2)
  }

  return (await response.text()).trim()
}

export async function generateOmakaseText(input: string, temperature = 0.1): Promise<string> {
  const { baseUrl, headers } = getClientConfig()
  const response = await fetch(`${baseUrl}/llm/v1/chat/completions`, {
    method: 'POST',
    headers: withContentType(headers, 'application/json'),
    body: JSON.stringify({ input, temperature }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const text = await parseTextResponse(response)
  return text || 'AI 응답을 받지 못했습니다.'
}

export async function generateOmakaseImageText(
  image: Buffer | Blob,
  fileName: string,
  prompt?: string,
  temperature = 0.1,
): Promise<string> {
  const formData = new FormData()
  const blob =
    image instanceof Blob
      ? image
      : new Blob([new Uint8Array(image)], { type: 'application/octet-stream' })

  formData.append('image', blob, fileName)
  if (prompt?.trim()) formData.append('prompt', prompt.trim())
  formData.append('temperature', String(temperature))

  const { baseUrl, headers } = getClientConfig()
  const response = await fetch(`${baseUrl}/ocr/api/image/analyze`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const text = await parseTextResponse(response)
  return text || 'OCR 결과를 받지 못했습니다.'
}

export function isOmakaseConfigured(): boolean {
  return Boolean(getApiKey() && getBaseUrl())
}
