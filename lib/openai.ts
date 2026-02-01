import OpenAI from 'openai'
import { Profile } from '@/types/database'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const ageRangeLabels: Record<string, string> = {
  '20s_early': '20대 초반',
  '20s_late': '20대 후반',
  '30s': '30대',
  '40s_plus': '40대 이상',
}

const stayTimeLabels: Record<string, string> = {
  '아침': '주로 아침에 집에 있음',
  '저녁': '주로 저녁에 집에 있음',
  '주말만': '주말에만 집에 있음',
  '거의없음': '거의 집에 없음',
}

export async function generateIntro(profile: Profile): Promise<string> {
  const profileSummary = [
    profile.name ? `이름: ${profile.name}` : null,
    profile.age_range ? `연령대: ${ageRangeLabels[profile.age_range] || profile.age_range}` : null,
    profile.family_type ? `가구유형: ${profile.family_type}` : null,
    profile.pets?.length ? `반려동물: ${profile.pets.join(', ')}` : '반려동물: 없음',
    `흡연: ${profile.smoking ? '예' : '아니오'}`,
    profile.stay_time ? `생활패턴: ${stayTimeLabels[profile.stay_time] || profile.stay_time}` : null,
    profile.duration ? `희망 거주기간: ${profile.duration}` : null,
    profile.noise_level ? `활동성: ${profile.noise_level}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `당신은 한국의 세입자가 집주인에게 보내는 자기소개서를 작성하는 도우미입니다.
아래 프로필 정보를 바탕으로, 집주인이 안심할 수 있도록 정중하고 신뢰감 있는 자기소개서를 작성해주세요.

프로필 정보:
${profileSummary}

조건:
- 한국어로 작성
- 300자 이내
- 자연스럽고 정중한 톤
- 집주인이 안심할 수 있는 내용 위주
- "안녕하세요"로 시작`

  // Mock response when no API key
  if (!openai) {
    const name = profile.name || '세입자'
    const duration = profile.duration || '장기'
    const smoking = profile.smoking ? '' : '비흡연자이며, '
    const pets = profile.pets?.includes('없음') || !profile.pets?.length
      ? '반려동물 없이'
      : `${profile.pets.join(', ')}와 함께`

    return `안녕하세요. ${name}입니다. ${smoking}${pets} 조용하게 생활하고 있습니다. ${duration} 거주를 희망하며, 깨끗하고 질서 있는 생활을 중요하게 생각합니다. 집을 소중히 관리하겠습니다. 잘 부탁드립니다.`
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  })

  return completion.choices[0]?.message?.content?.trim() || '자기소개서 생성에 실패했습니다.'
}
