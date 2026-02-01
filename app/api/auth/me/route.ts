import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        userType: user.user_type,
        auth_provider: user.auth_provider,
        phone_verified: user.phone_verified,
        profile_image: user.profile_image,
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
