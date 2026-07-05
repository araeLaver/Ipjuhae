const SUPPORTED_DOCUMENT_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
])

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export const MAX_DOCUMENT_FILE_SIZE = 20 * 1024 * 1024

export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as File
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  )
}

export function normalizeDocumentContentType(
  fileName: string,
  rawContentType?: string | null,
): string | null {
  const lowerName = fileName.toLowerCase()
  const extension = lowerName.match(/\.[^.]+$/)?.[0] || ''
  const extensionContentType = EXTENSION_CONTENT_TYPES[extension] || null
  const contentType = (rawContentType || '').split(';')[0]?.trim().toLowerCase() || ''

  if (contentType && contentType !== 'application/octet-stream') {
    if (!SUPPORTED_DOCUMENT_CONTENT_TYPES.has(contentType)) {
      return null
    }

    if (extensionContentType && extensionContentType !== contentType) {
      return null
    }

    return contentType
  }

  return extensionContentType
}

export function validateDocumentFile(
  file: File,
  maxFileSize = MAX_DOCUMENT_FILE_SIZE,
): { contentType: string } | { error: string } {
  if (file.size > maxFileSize) {
    return { error: '파일 크기는 20MB 이하여야 합니다' }
  }

  const contentType = normalizeDocumentContentType(file.name, file.type)
  if (!contentType) {
    return { error: 'PDF, JPG, PNG 파일만 업로드할 수 있습니다' }
  }

  return { contentType }
}
