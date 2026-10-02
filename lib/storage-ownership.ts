import { createHash } from 'node:crypto'

// Pin the server-configured destination, without storing credentials.
export function storageObjectScope(): string {
  const scope = process.env.STORAGE_PROVIDER === 's3'
    ? ['s3', process.env.S3_ENDPOINT || '', process.env.S3_BUCKET || '', process.env.S3_PUBLIC_URL || '']
    : ['mock', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000']
  return createHash('sha256').update(JSON.stringify(scope)).digest('hex')
}
export function assertServerUploadNamespace(key: string, ownerUserId: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ownerUserId) || !['profiles','verifications','properties'].some(folder => key.startsWith(`${folder}/${ownerUserId}/`)) || key.includes('..') || /[%\\?#]/.test(key)) {
    throw new Error('Untrusted upload namespace')
  }
}
