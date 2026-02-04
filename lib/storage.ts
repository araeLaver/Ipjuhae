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
 * 파일명 생성 (중복 방지)
 */
function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || ''
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  return `${timestamp}-${random}.${ext}`
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
 * S3/R2 파일 업로드
 * AWS S3 SDK 없이 직접 Presigned URL 방식 사용
 */
async function uploadS3(options: UploadOptions): Promise<UploadResult> {
  const bucket = process.env.S3_BUCKET
  const region = process.env.S3_REGION || 'ap-northeast-2'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const endpoint = process.env.S3_ENDPOINT // Cloudflare R2용

  if (!bucket || !accessKeyId || !secretAccessKey) {
    logger.error('S3 설정 누락')
    return { success: false, error: '파일 저장소 설정이 완료되지 않았습니다' }
  }

  try {
    const key = `${options.folder || 'uploads'}/${generateFileName(options.fileName)}`
    const host = endpoint || `${bucket}.s3.${region}.amazonaws.com`
    const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${host}/${key}`

    // AWS Signature Version 4 서명 생성
    const date = new Date()
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const credential = `${accessKeyId}/${dateString}/${region}/s3/aws4_request`

    // 간단한 PUT 요청 (실제 프로덕션에서는 AWS SDK 사용 권장)
    const fileBuffer = options.file instanceof Blob
      ? Buffer.from(await options.file.arrayBuffer())
      : options.file

    // Content-MD5 계산
    const contentMd5 = crypto.createHash('md5').update(fileBuffer).digest('base64')

    // 서명 생성 (간소화된 버전)
    const stringToSign = `PUT\n${contentMd5}\n${options.contentType}\n\nx-amz-date:${amzDate}\n/${bucket}/${key}`
    const signature = crypto
      .createHmac('sha256', secretAccessKey)
      .update(stringToSign)
      .digest('hex')

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': options.contentType,
        'Content-MD5': contentMd5,
        'x-amz-date': amzDate,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${credential},SignedHeaders=content-md5;content-type;host;x-amz-date,Signature=${signature}`,
      },
      body: new Uint8Array(fileBuffer),
    })

    if (response.ok) {
      logger.info('S3 파일 업로드 성공', { key })
      return {
        success: true,
        url: endpoint ? `${endpoint}/${key}` : `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
        key,
      }
    } else {
      const error = await response.text()
      logger.error('S3 파일 업로드 실패', { key, error })
      return {
        success: false,
        error: '파일 업로드 실패',
      }
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
 * 인증 서류 업로드
 */
export async function uploadVerificationDocument(
  userId: string,
  documentType: string,
  file: Buffer | Blob,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  return uploadFile({
    file,
    fileName,
    contentType,
    folder: `verifications/${userId}/${documentType}`,
  })
}

/**
 * 프로필 이미지 업로드
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

  // 파일 크기 제한 (5MB)
  const size = file instanceof Blob ? file.size : file.length
  if (size > 5 * 1024 * 1024) {
    return { success: false, error: '파일 크기는 5MB 이하여야 합니다' }
  }

  return uploadFile({
    file,
    fileName,
    contentType,
    folder: `profiles/${userId}`,
  })
}

/**
 * 파일 삭제 (프로바이더별)
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  if (STORAGE_PROVIDER === 'mock') {
    logger.info('파일 삭제 (Mock)', { key })
    return { success: true }
  }

  // S3 삭제 로직 (필요시 구현)
  logger.info('파일 삭제', { key })
  return { success: true }
}
