import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { logger } from '@/lib/logger'
import { normalizeAiRegistryPayload } from '@/lib/registry-parser'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

/**
 * POST /api/check/parse-registry
 *
 * 등기부등본(갑구·을구) 캡처 이미지를 1회 분석해 근저당 채권최고액(만원)과
 * 위험 신호 코드(신탁·압류·가압류·경매·임차권등기·가등기)만 반환한다.
 * 이미지나 개인정보(성명·주민번호·주소)는 서버나 DB에 저장하지 않는다.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error: '현재 이미지 AI 분석이 비활성화되어 있습니다. 아래 "텍스트 붙여넣기"로 무료 자동 추출을 이용해 주세요.',
        code: 'AI_UNAVAILABLE',
      },
      { status: 503 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '이미지 파일을 함께 전송해 주세요.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '등기부등본 캡처 이미지 파일을 선택해 주세요.' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'PNG, JPG, WEBP 형식의 이미지 파일만 분석할 수 있습니다.' },
      { status: 400 }
    )
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: '이미지 크기는 5MB 이하여야 합니다.' },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '당신은 대한민국 부동산 등기부등본(갑구·을구) 요약 추출기입니다. ' +
            '개인정보(성명, 주민등록번호, 상세주소)는 절대 출력하지 마세요. ' +
            '말소선(취소선)이 그어진 항목은 제외하고, 현재 유효한 을구 근저당권의 채권최고액(만원 단위 정수 배열)과 ' +
            '갑구·을구 위험 신호 코드만 JSON으로 반환하세요. ' +
            '허용 flagCodes: ["trust","seizure","provisional_seizure","auction","lease_registration","provisional_registration"]. ' +
            '응답 형식: {"mortgageEntriesManwon": number[], "mortgageMaxManwon": number, "flagCodes": string[]}',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 등기부등본 이미지에서 현재 유효한 근저당 채권최고액(만원 단위)과 위험 신호 코드만 JSON으로 추출해 주세요.',
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {}
    }

    const result = normalizeAiRegistryPayload(parsed)
    return NextResponse.json({ result })
  } catch (error) {
    logger.error('등기부 이미지 분석 오류', { error })
    return NextResponse.json(
      { error: '이미지를 분석하지 못했습니다. 선명한 캡처로 다시 시도하거나 텍스트 붙여넣기를 이용해 주세요.' },
      { status: 502 }
    )
  }
}
