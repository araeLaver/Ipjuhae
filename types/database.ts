export type AgeRange = '20대초반' | '20대후반' | '30대' | '40대이상'
export type FamilyType = '1인' | '커플' | '가족'
export type Pet = '없음' | '강아지' | '고양이' | '기타'
export type StayTime = '아침' | '저녁' | '주말만' | '거의없음'
export type Duration = '6개월' | '1년' | '2년' | '장기'
export type NoiseLevel = '조용' | '보통' | '활발'

export interface User {
  id: string
  email: string
  password_hash: string
  name: string | null
  created_at: Date
  updated_at: Date
}

export interface Profile {
  id: string
  user_id: string
  name: string
  age_range: AgeRange
  family_type: FamilyType
  pets: Pet[]
  smoking: boolean
  stay_time: StayTime | null
  duration: Duration | null
  noise_level: NoiseLevel | null
  bio: string | null
  intro: string | null
  trust_score: number
  is_complete: boolean
  created_at: Date
  updated_at: Date
}
