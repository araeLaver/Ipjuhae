import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { generateOmakaseText } from '@/lib/ai-omakase'

type LegalizeRequest = {
  topic?: string
  question?: string
  facts?: string
  desiredOutcome?: string
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as LegalizeRequest
    const question = body.question?.trim()
    const topic = body.topic?.trim() || '부동산/플랫폼/창업 관련 법률 검토'
    const facts = body.facts?.trim()
    const desiredOutcome = body.desiredOutcome?.trim()

    if (!question) {
      return NextResponse.json({ error: '질문을 입력해주세요' }, { status: 400 })
    }

    const prompt = [
      '당신은 한국 시장의 실무형 법률자문 보조 도구입니다.',
      '직접적인 변호사 자문을 가장하지 말고, 리스크와 확인사항을 우선 정리하세요.',
      '한국어로 작성하고, 짧은 문장과 실행 가능한 항목 중심으로 답하세요.',
      '',
      `주제: ${topic}`,
      `질문: ${question}`,
      facts ? `사실관계: ${facts}` : null,
      desiredOutcome ? `원하는 결과: ${desiredOutcome}` : null,
      '',
      '출력 형식:',
      '1. 핵심 판단',
      '2. 확인해야 할 쟁점',
      '3. 바로 할 일',
      '4. 변리사/변호사에게 물어볼 추가 질문',
      '',
      '주의: 확답이 어려운 부분은 조건부로 표현하고, 과도한 법률 단정은 피하세요.',
    ]
      .filter(Boolean)
      .join('\n')

    const answer = await generateOmakaseText(prompt, 0.1)

    return NextResponse.json({
      answer,
      provider: 'ai-omakase',
    })
  } catch (error) {
    console.error('Legalize Kr error:', error)
    return NextResponse.json(
      { error: '법률 자문 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
