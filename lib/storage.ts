/**
 * 파일 업로드/저장소 모듈
 *
 * 지원 프로바이더:
 * - mock: 개발/테스트용 (로컬 저장)
 * - s3: AWS S3 / Cloudflare R2
 *
 * 환경변수:
 * - STORAGE_PROVIDER: 'mock' | 's3' (기본: mock)
 */

import { logger } from './logger'
import crypto from 'crypto'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { optimizeProfileImage, optimizeDocumentImage, validateImage } from './image'

interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

interface UploadOptions {
  file: Buffer | Blob
  fileName: string
  contentType: string
  folder?: string
}

type StorageProvider = 'mock' | 's3'

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER as StorageProvider) || 'mock'

/**
 * S3/R2 클라이언트 (lazy init)
 */
let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    })
  }
  return s3Client
}

/**
 * 파일명 생성 (중복 방지)
 */
function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || ''
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  return `${timestamp}-${random}.${ext}`
}

/**
 * R2 퍼블릭 URL 생성
 */
function getPublicUrl(key: string): string {
  const publicUrl = process.env.S3_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }
  // R2.dev 퍼블릭 도메인 또는 커스텀 도메인
  const bucket = process.env.S3_BUCKET
  return `${process.env.S3_ENDPOINT}/${bucket}/${key}`
}

/**
 * Mock 파일 업로드 (개발용)
 */
async function uploadMock(options: UploadOptions): Promise<UploadResult> {
  const key = `${options.folder || 'uploads'}/${generateFileName(options.fileName)}`
  logger.info('파일 업로드 (Mock)', { key, contentType: options.contentType })

  // Mock URL 생성
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/mock-storage/${key}`

  return {
    success: true,
    url,
    key,
  }
}

/**
 * S3/R2 파일 업로드 (AWS SDK v3)
 */
async function uploadS3(options: UploadOptions): Promise<UploadResult> {
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) {
    logger.error('S3 설정 누락')
    return { success: false, error: '파일 저장소 설정이 완료되지 않았습니다' }
  }

  try {
    const key = `${options.folder || 'uploads'}/${generateFileName(options.fileName)}`

    const fileBuffer = options.file instanceof Blob
      ? Buffer.from(await options.file.arrayBuffer())
      : options.file

    const client = getS3Client()
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: options.contentType,
    }))

    const url = getPublicUrl(key)
    logger.info('S3 파일 업로드 성공', { key, url })

    return {
      success: true,
      url,
      key,
    }
  } catch (error) {
    logger.error('S3 파일 업로드 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '파일 업로드 오류',
    }
  }
}

/**
 * 파일 업로드 (프로바이더 자동 선택)
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  switch (STORAGE_PROVIDER) {
    case 's3':
      return uploadS3(options)
    default:
      return uploadMock(options)
  }
}

/**
 * 인증 서류 업로드 (이미지인 경우 자동 최적화)
 */
export async function uploadVerificationDocument(
  userId: string,
  documentType: string,
  file: Buffer | Blob,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  // 이미지인 경우 최적화 적용
  if (contentType.startsWith('image/')) {
    const buffer = file instanceof Blob
      ? Buffer.from(await file.arrayBuffer())
      : file

    // 이미지 유효성 검사
    const validation = await validateImage(buffer, {
      maxSize: 20 * 1024 * 1024, // 서류는 20MB까지 허용
    })
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // 서류 이미지 최적화 (최대 1920px, JPEG)
    const optimized = await optimizeDocumentImage(buffer)
    if (!optimized.success || !optimized.buffer) {
      return { success: false, error: optimized.error || '이미지 최적화 실패' }
    }

    logger.info('서류 이미지 최적화 완료', {
      originalSize: buffer.length,
      optimizedSize: optimized.size,
      documentType,
    })

    const optimizedFileName = fileName.replace(/\.[^.]+$/, '.jpg')

    return uploadFile({
      file: optimized.buffer,
      fileName: optimizedFileName,
      contentType: 'image/jpeg',
      folder: `verifications/${userId}/${documentType}`,
    })
  }

  // PDF 등 다른 파일 형식은 그대로 업로드
  return uploadFile({
    file,
    fileName,
    contentType,
    folder: `verifications/${userId}/${documentType}`,
  })
}

/**
 * 프로필 이미지 업로드 (자동 최적화)
 */
export async function uploadProfileImage(
  userId: string,
  file: Buffer | Blob,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  // 이미지 타입 검증
  if (!contentType.startsWith('image/')) {
    return { success: false, error: '이미지 파일만 업로드 가능합니다' }
  }

  // Buffer로 변환
  const buffer = file instanceof Blob
    ? Buffer.from(await file.arrayBuffer())
    : file

  // 파일 크기 제한 (10MB, 최적화 전)
  if (buffer.length > 10 * 1024 * 1024) {
    return { success: false, error: '파일 크기는 10MB 이하여야 합니다' }
  }

  // 이미지 유효성 검사
  const validation = await validateImage(buffer)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // 이미지 최적화 (400x400 WebP)
  const optimized = await optimizeProfileImage(buffer)
  if (!optimized.success || !optimized.buffer) {
    return { success: false, error: optimized.error || '이미지 최적화 실패' }
  }

  logger.info('프로필 이미지 최적화 완료', {
    originalSize: buffer.length,
    optimizedSize: optimized.size,
    reduction: `${Math.round((1 - (optimized.size || 0) / buffer.length) * 100)}%`,
  })

  // 파일명을 .webp로 변경
  const optimizedFileName = fileName.replace(/\.[^.]+$/, '.webp')

  return uploadFile({
    file: optimized.buffer,
    fileName: optimizedFileName,
    contentType: 'image/webp',
    folder: `profiles/${userId}`,
  })
}

/**
 * 파일 삭제
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  if (STORAGE_PROVIDER === 'mock') {
    logger.info('파일 삭제 (Mock)', { key })
    return { success: true }
  }

  try {
    const client = getS3Client()
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }))
    logger.info('S3 파일 삭제 성공', { key })
    return { success: true }
  } catch (error) {
    logger.error('S3 파일 삭제 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '파일 삭제 오류',
    }
  }
}
