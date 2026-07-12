export interface CursorPayload {
  createdAt: string
  id: string
}

const CREATED_AT_FIELD = 'createdAt'

export function encodeCursor(createdAt: string | Date, id: string): string {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid created_at value for cursor')
  }

  return Buffer.from(
    JSON.stringify({
      [CREATED_AT_FIELD]: parsed.toISOString(),
      id,
    })
  ).toString('base64')
}

export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) return null
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Partial<CursorPayload>
    if (!decoded || !decoded.createdAt || !decoded.id) {
      return null
    }
    const createdAt = new Date(decoded.createdAt)
    if (Number.isNaN(createdAt.getTime())) {
      return null
    }
    return {
      createdAt: createdAt.toISOString(),
      id: decoded.id,
    }
  } catch {
    return null
  }
}
