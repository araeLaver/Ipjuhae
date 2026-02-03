import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { User, AuthProvider } from '@/types/database'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']

export async function POST(request: Request) {
  try {
    const {
      provider,
      providerId,
      email,
      name,
      profileImage,
      userType,
      termsAgreed,
      privacyAgreed,
      marketingAgreed,
    } = await request.json()

    if (!provider || !providerId || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: '유효하지 않은 소셜 정보입니다' }, { status: 400 })
    }

    if (!termsAgreed || !privacyAgreed) {
      return NextResponse.json({ error: '필수 약관에 동의해주세요' }, { status: 400 })
    }

    // 중복 체크
    const existing = await queryOne<User>(
      'SELECT id FROM users WHERE auth_provider = $1 AND auth_provider_id = $2',
      [provider, providerId]
    )

    if (existing) {
      return NextResponse.json({ error: '이미 가입된 계정입니다' }, { status: 400 })
    }

    if (email) {
      const emailUser = await queryOne<User>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      )
      if (emailUser) {
        return NextResponse.json({ error: '이미 사용 중인 이메일입니다' }, { status: 400 })
      }
    }

    const validUserType = userType === 'landlord' ? 'landlord' : 'tenant'
    const now = new Date().toISOString()

    const [user] = await query<User>(
      `INSERT INTO users (
        email, name, user_type, auth_provider, auth_provider_id,
        profile_image, terms_agreed_at, privacy_agreed_at, marketing_agreed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        email,
        name,
        validUserType,
        provider,
        providerId,
        profileImage,
        now,
        now,
        marketingAgreed ? now : null,
      ]
    )

    const token = generateToken(user.id)
    await setAuthCookie(token)

    return NextResponse.json({ success: true, userId: user.id, userType: validUserType })
  } catch (error) {
    console.error('Social signup error:', error)
    return NextResponse.json({ error: '소셜 회원가입 중 오류가 발생했습니다' }, { status: 500 })
  }
}
