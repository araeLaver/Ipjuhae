import { SortOption } from '@/lib/validations'

interface CursorPayload {
  sort: SortOption
  value: number | string
  id: string
}

const SORT_OPTIONS: SortOption[] = ['trust_desc', 'created_desc', 'reference_desc', 'verified_desc']

export function encodeTenantCursor(sort: SortOption, value: number | string, id: string): string {
  return Buffer.from(JSON.stringify({ sort, value, id })).toString('base64')
}

export function decodeTenantCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Partial<CursorPayload>
    if (
      !parsed ||
      !parsed.id ||
      !parsed.sort ||
      !SORT_OPTIONS.includes(parsed.sort) ||
      (typeof parsed.value !== 'number' && typeof parsed.value !== 'string')
    ) {
      return null
    }

    return {
      sort: parsed.sort,
      value: parsed.value,
      id: parsed.id,
    }
  } catch {
    return null
  }
}
