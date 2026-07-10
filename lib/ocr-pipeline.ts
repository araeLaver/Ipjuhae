import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'

import sharp from 'sharp'

import { generateOmakaseImageText } from '@/lib/ai-omakase'

const execFileAsync = promisify(execFile)

const DEFAULT_OCR_PROMPT = '이미지의 문구와 핵심 정보를 한국어로 정확히 추출해 주세요.'
const IMAGE_SPLIT_THRESHOLD_HEIGHT = 3200
const IMAGE_CHUNK_HEIGHT = 2200
const IMAGE_CHUNK_OVERLAP = 160
const OCR_MINIMUM_TEXT_LENGTH = 30

interface OcrCandidate {
  buffer: Buffer
  fileName: string
}

export interface OcrPipelineOptions {
  prompt?: string
  temperature?: number
  pdfUnlockCode?: string
}

export interface OcrPipelineResult {
  text: string
  source: 'image' | 'pdf'
}

function isPdf(fileName: string, fileType?: string): boolean {
  const type = (fileType || '').toLowerCase()
  return type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
}

function isUsableText(text: string): boolean {
  const trimmed = text.replace(/\s/g, '')
  return trimmed.length >= OCR_MINIMUM_TEXT_LENGTH
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mergeTextBlocks(blocks: string[]): string {
  return blocks
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join('\n\n')
}

async function ocrSingleImage(
  file: OcrCandidate,
  prompt: string,
  temperature: number,
): Promise<string> {
  const result = await generateOmakaseImageText(file.buffer, file.fileName, prompt, temperature)
  return normalizeText(result)
}

async function splitImageIfTall(file: OcrCandidate): Promise<OcrCandidate[]> {
  try {
    const image = sharp(file.buffer)
    const metadata = await image.metadata()

    if (!metadata.height || metadata.height <= IMAGE_SPLIT_THRESHOLD_HEIGHT) {
      return [file]
    }

    if (!metadata.width || metadata.width <= 0) {
      return [file]
    }

    const chunks: OcrCandidate[] = []
    const baseName = file.fileName.replace(/\.[^/.]+$/, '')
    const step = Math.max(IMAGE_CHUNK_HEIGHT - IMAGE_CHUNK_OVERLAP, 1)
    let top = 0
    let index = 1

    while (top < metadata.height) {
      const height = Math.min(IMAGE_CHUNK_HEIGHT, metadata.height - top)
      const chunkBuffer = await image
        .clone()
        .extract({
          left: 0,
          top,
          width: metadata.width,
          height,
        })
        .png()
        .toBuffer()

      chunks.push({
        buffer: chunkBuffer,
        fileName: `${baseName}_part_${index}.png`,
      })

      index += 1
      top += step
    }

    return chunks
  } catch {
    return [file]
  }
}

async function extractImageText(
  file: OcrCandidate,
  prompt: string,
  temperature: number,
): Promise<string> {
  const firstPass = await ocrSingleImage(file, prompt, temperature)
  if (isUsableText(firstPass)) {
    return firstPass
  }

  const splitCandidates = await splitImageIfTall(file)
  if (splitCandidates.length === 1) {
    return firstPass
  }

  const chunkTexts = []
  for (const chunk of splitCandidates) {
    const chunkText = await ocrSingleImage(chunk, prompt, temperature)
    if (chunkText) {
      chunkTexts.push(chunkText)
    }
  }

  return mergeTextBlocks(chunkTexts) || firstPass
}

async function extractPdfText(
  buffer: Buffer,
  fileName: string,
  prompt: string,
  temperature: number,
  pdfUnlockCode?: string,
): Promise<string> {
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ipjuhae-ocr-'))
  const sourcePdf = path.join(workDir, 'source.pdf')
  const imagePrefix = path.join(workDir, 'page')

  try {
    await writeFile(sourcePdf, buffer)

    const args = [
      ...(pdfUnlockCode ? ['-upw', pdfUnlockCode, '-opw', pdfUnlockCode] : []),
      '-png',
      '-r',
      '200',
      sourcePdf,
      imagePrefix,
    ]

    try {
      await execFileAsync('pdftoppm', args, {
        cwd: workDir,
        maxBuffer: 40 * 1024 * 1024,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('incorrect password') || message.includes('failed to decrypt')) {
        throw new Error('PDF 비밀번호가 필요하거나 일치하지 않습니다.')
      }
      throw error
    }

    const prefixName = path.basename(imagePrefix)
    const pageFiles = (await readdir(workDir))
      .filter((name) => name.startsWith(`${prefixName}-`))
      .filter((name) => /\.(png|jpg|jpeg)$/i.test(name))
      .sort((a, b) => {
        const aMatch = a.match(/-(\d+)\./)
        const bMatch = b.match(/-(\d+)\./)
        const aIndex = Number.parseInt(aMatch?.[1] || '0', 10)
        const bIndex = Number.parseInt(bMatch?.[1] || '0', 10)
        return aIndex - bIndex
      })

    if (!pageFiles.length) {
      throw new Error('PDF 변환 결과가 없습니다')
    }

    const pageTexts: string[] = []
    for (let index = 0; index < pageFiles.length; index += 1) {
      const pageFile = pageFiles[index]
      const pageBuffer = await readFile(path.join(workDir, pageFile))
      const pageText = await extractImageText(
        {
          buffer: pageBuffer,
          fileName: `${fileName}-p${index + 1}.png`,
        },
        prompt,
        temperature,
      )

      if (pageText) {
        pageTexts.push(pageText)
      }
    }

    if (!pageTexts.length) {
      throw new Error('PDF에서 텍스트를 추출하지 못했습니다')
    }

    return mergeTextBlocks(pageTexts)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function extractTextFromDocument(
  file: File,
  options: OcrPipelineOptions = {},
): Promise<OcrPipelineResult> {
  const fileName = file.name || 'document.png'
  const fileType = file.type
  const prompt = (options.prompt || DEFAULT_OCR_PROMPT).trim() || DEFAULT_OCR_PROMPT
  const temperature = Number.isFinite(options.temperature ?? 0.1) ? (options.temperature as number) : 0.1
  const buffer = Buffer.from(await file.arrayBuffer())

  if (isPdf(fileName, fileType)) {
    const text = await extractPdfText(
      buffer,
      fileName,
      prompt,
      temperature,
      options.pdfUnlockCode,
    )
    return { text, source: 'pdf' }
  }

  const text = await extractImageText(
    { buffer, fileName },
    prompt,
    temperature,
  )
  return { text, source: 'image' }
}
