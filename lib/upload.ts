/**
 * 매물 사진 업로드 헬퍼
 *
 * AWS_BUCKET_NAME 환경변수가 있으면 S3에 업로드,
 * 없으면 /public/uploads/ 에 로컬 저장 후 URL 반환
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

function generateKey(filename: string): string {
  const ext = filename.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  return `listings/${timestamp}-${random}.${ext}`
}

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
      },
    })
  }
  return s3Client
}

async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const bucket = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET!
  const client = getS3Client()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )

  const publicUrl = process.env.S3_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }

  const endpoint = process.env.S3_ENDPOINT
  if (endpoint) {
    return `${endpoint}/${bucket}/${key}`
  }

  return `https://${bucket}.s3.amazonaws.com/${key}`
}

async function uploadToLocal(buffer: Buffer, key: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'listings')
  await mkdir(uploadDir, { recursive: true })

  const filename = key.replace('listings/', '')
  const filePath = path.join(uploadDir, filename)
  await writeFile(filePath, buffer)

  return `/uploads/listings/${filename}`
}

/**
 * 매물 사진 업로드
 * @param file File 객체 또는 Buffer
 * @param filename 원본 파일명 (확장자 추출에 사용)
 * @returns 업로드된 파일의 공개 URL
 */
export async function uploadListingPhoto(
  file: File | Buffer,
  filename: string
): Promise<string> {
  const buffer =
    file instanceof Buffer ? file : Buffer.from(await (file as File).arrayBuffer())

  const contentType =
    file instanceof Buffer
      ? 'image/jpeg'
      : (file as File).type || 'image/jpeg'

  const key = generateKey(filename)

  const hasBucket = !!(process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET)
  const hasCredentials = !!(
    (process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)
  )

  if (hasBucket && hasCredentials) {
    try {
      return await uploadToS3(buffer, key, contentType)
    } catch (err) {
      console.error('[upload] S3 업로드 실패, 로컬 저장소로 fallback:', err)
      return await uploadToLocal(buffer, key)
    }
  }

  return await uploadToLocal(buffer, key)
}
