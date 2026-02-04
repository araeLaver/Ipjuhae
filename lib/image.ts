/**
 * 이미지 처리/최적화 모듈
 *
 * 기능:
 * - 이미지 리사이징
 * - 포맷 변환 (WebP 최적화)
 * - 썸네일 생성
 * - 프로필 이미지 최적화
 *
 * 의존성: sharp
 */

import sharp from 'sharp'
import { logger } from './logger'

interface ImageProcessResult {
  success: boolean
  buffer?: Buffer
  format?: string
  width?: number
  height?: number
  size?: number
  error?: string
}

interface ResizeOptions {
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
}

/**
 * 이미지 리사이징
 */
export async function resizeImage(
  input: Buffer,
  options: ResizeOptions
): Promise<ImageProcessResult> {
  try {
    const { width, height, fit = 'cover', format = 'webp', quality = 80 } = options

    let pipeline = sharp(input)

    // 리사이징
    if (width || height) {
      pipeline = pipeline.resize(width, height, { fit })
    }

    // 포맷 변환 및 압축
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true })
        break
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
      case 'avif':
        pipeline = pipeline.avif({ quality })
        break
    }

    const buffer = await pipeline.toBuffer()
    const metadata = await sharp(buffer).metadata()

    logger.info('이미지 리사이징 완료', {
      originalSize: input.length,
      newSize: buffer.length,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    })

    return {
      success: true,
      buffer,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
    }
  } catch (error) {
    logger.error('이미지 리사이징 오류', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : '이미지 처리 오류',
    }
  }
}

/**
 * 프로필 이미지 최적화
 * - 400x400 정사각형 크롭
 * - WebP 변환
 * - 품질 80%
 */
export async function optimizeProfileImage(input: Buffer): Promise<ImageProcessResult> {
  return resizeImage(input, {
    width: 400,
    height: 400,
    fit: 'cover',
    format: 'webp',
    quality: 80,
  })
}

/**
 * 썸네일 생성
 * - 200x200 정사각형
 * - WebP 변환
 * - 품질 70%
 */
export async function createThumbnail(input: Buffer): Promise<ImageProcessResult> {
  return resizeImage(input, {
    width: 200,
    height: 200,
    fit: 'cover',
    format: 'webp',
    quality: 70,
  })
}

/**
 * 서류 이미지 최적화
 * - 최대 1920px 너비
 * - 원본 비율 유지
 * - JPEG 변환 (문서 가독성)
 */
export async function optimizeDocumentImage(input: Buffer): Promise<ImageProcessResult> {
  return resizeImage(input, {
    width: 1920,
    fit: 'inside',
    format: 'jpeg',
    quality: 85,
  })
}

/**
 * 이미지 메타데이터 조회
 */
export async function getImageMetadata(input: Buffer): Promise<{
  width?: number
  height?: number
  format?: string
  size: number
} | null> {
  try {
    const metadata = await sharp(input).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: input.length,
    }
  } catch {
    return null
  }
}

/**
 * 이미지 유효성 검사
 */
export async function validateImage(
  input: Buffer,
  options?: {
    maxWidth?: number
    maxHeight?: number
    maxSize?: number
    allowedFormats?: string[]
  }
): Promise<{ valid: boolean; error?: string }> {
  const {
    maxWidth = 4096,
    maxHeight = 4096,
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'],
  } = options || {}

  // 파일 크기 검사
  if (input.length > maxSize) {
    return { valid: false, error: `파일 크기가 ${Math.round(maxSize / 1024 / 1024)}MB를 초과합니다` }
  }

  try {
    const metadata = await sharp(input).metadata()

    // 포맷 검사
    if (!metadata.format || !allowedFormats.includes(metadata.format)) {
      return { valid: false, error: '지원하지 않는 이미지 형식입니다' }
    }

    // 해상도 검사
    if (metadata.width && metadata.width > maxWidth) {
      return { valid: false, error: `이미지 너비가 ${maxWidth}px를 초과합니다` }
    }

    if (metadata.height && metadata.height > maxHeight) {
      return { valid: false, error: `이미지 높이가 ${maxHeight}px를 초과합니다` }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: '올바른 이미지 파일이 아닙니다' }
  }
}
