import { describe, it, expect, beforeAll } from 'vitest'
import sharp from 'sharp'
import {
  resizeImage,
  optimizeProfileImage,
  createThumbnail,
  optimizeDocumentImage,
  getImageMetadata,
  validateImage,
} from '@/lib/image'

// 테스트용 이미지 버퍼
let VALID_PNG: Buffer
let VALID_JPEG: Buffer
const INVALID_FILE = Buffer.from('This is not an image')

// 테스트 전에 유효한 이미지 생성
beforeAll(async () => {
  // 100x100 빨간색 PNG 이미지 생성
  VALID_PNG = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer()

  // 100x100 파란색 JPEG 이미지 생성
  VALID_JPEG = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 0, g: 0, b: 255 },
    },
  })
    .jpeg()
    .toBuffer()
})

describe('이미지 처리 모듈', () => {
  describe('resizeImage', () => {
    it('이미지를 리사이징할 수 있다', async () => {
      const result = await resizeImage(VALID_PNG, {
        width: 50,
        height: 50,
        format: 'webp',
      })

      expect(result.success).toBe(true)
      expect(result.buffer).toBeDefined()
      expect(result.width).toBe(50)
      expect(result.height).toBe(50)
      expect(result.format).toBe('webp')
    })

    it('다양한 포맷으로 변환할 수 있다', async () => {
      const formats = ['jpeg', 'png', 'webp'] as const

      for (const format of formats) {
        const result = await resizeImage(VALID_PNG, { format })
        expect(result.success).toBe(true)
        expect(result.format).toBe(format)
      }
    })

    it('잘못된 이미지는 실패한다', async () => {
      const result = await resizeImage(INVALID_FILE, { width: 100 })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('품질 설정이 적용된다', async () => {
      const highQuality = await resizeImage(VALID_PNG, { format: 'jpeg', quality: 100 })
      const lowQuality = await resizeImage(VALID_PNG, { format: 'jpeg', quality: 10 })

      expect(highQuality.success).toBe(true)
      expect(lowQuality.success).toBe(true)
      // 저품질 이미지가 더 작아야 함
      expect(lowQuality.size!).toBeLessThan(highQuality.size!)
    })
  })

  describe('optimizeProfileImage', () => {
    it('프로필 이미지를 400x400 WebP로 최적화한다', async () => {
      const result = await optimizeProfileImage(VALID_PNG)

      expect(result.success).toBe(true)
      expect(result.width).toBe(400)
      expect(result.height).toBe(400)
      expect(result.format).toBe('webp')
    })
  })

  describe('createThumbnail', () => {
    it('200x200 썸네일을 생성한다', async () => {
      const result = await createThumbnail(VALID_PNG)

      expect(result.success).toBe(true)
      expect(result.width).toBe(200)
      expect(result.height).toBe(200)
      expect(result.format).toBe('webp')
    })
  })

  describe('optimizeDocumentImage', () => {
    it('서류 이미지를 JPEG로 최적화한다', async () => {
      const result = await optimizeDocumentImage(VALID_PNG)

      expect(result.success).toBe(true)
      expect(result.format).toBe('jpeg')
    })

    it('큰 이미지를 1920px로 제한한다', async () => {
      // 3000x2000 이미지 생성
      const largeImage = await sharp({
        create: {
          width: 3000,
          height: 2000,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer()

      const result = await optimizeDocumentImage(largeImage)

      expect(result.success).toBe(true)
      expect(result.width).toBeLessThanOrEqual(1920)
    })
  })

  describe('getImageMetadata', () => {
    it('PNG 이미지 메타데이터를 반환한다', async () => {
      const metadata = await getImageMetadata(VALID_PNG)

      expect(metadata).not.toBeNull()
      expect(metadata?.width).toBe(100)
      expect(metadata?.height).toBe(100)
      expect(metadata?.format).toBe('png')
      expect(metadata?.size).toBe(VALID_PNG.length)
    })

    it('JPEG 이미지 메타데이터를 반환한다', async () => {
      const metadata = await getImageMetadata(VALID_JPEG)

      expect(metadata).not.toBeNull()
      expect(metadata?.format).toBe('jpeg')
    })

    it('잘못된 파일은 null을 반환한다', async () => {
      const metadata = await getImageMetadata(INVALID_FILE)
      expect(metadata).toBeNull()
    })
  })

  describe('validateImage', () => {
    it('유효한 이미지를 통과시킨다', async () => {
      const result = await validateImage(VALID_PNG)
      expect(result.valid).toBe(true)
    })

    it('JPEG 이미지도 통과시킨다', async () => {
      const result = await validateImage(VALID_JPEG)
      expect(result.valid).toBe(true)
    })

    it('잘못된 파일을 거부한다', async () => {
      const result = await validateImage(INVALID_FILE)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('올바른 이미지 파일이 아닙니다')
    })

    it('파일 크기 제한을 검사한다', async () => {
      const result = await validateImage(VALID_PNG, { maxSize: 10 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('파일 크기')
    })

    it('허용된 포맷만 통과시킨다', async () => {
      const result = await validateImage(VALID_PNG, { allowedFormats: ['jpeg'] })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('지원하지 않는 이미지 형식입니다')
    })

    it('해상도 제한을 검사한다', async () => {
      const result = await validateImage(VALID_PNG, { maxWidth: 50 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('너비')
    })
  })
})
