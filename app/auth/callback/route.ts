import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { queryOne, query } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { trackServer } from '@/lib/analytics'
import { User } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user?.email) {
      console.error('Magic link auth error:', error?.message)
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    const email = data.user.email

    // Check if user already exists in local DB
    let user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    let isNewUser = false

    if (!user) {
      // Create new user
      isNewUser = true
      const rows = await query<User>(
        `INSERT INTO users (email, user_type, auth_provider)
         VALUES ($1, 'tenant', 'magic_link')
         RETURNING *`,
        [email]
      )
      user = rows[0]
    }

    // Generate app JWT and set cookie
    const token = generateToken(user.id, user.user_type)
    await setAuthCookie(token)

    // Track user_signup for new users
    if (isNewUser) {
      await trackServer('user_signup', {
        userId: user.id,
        properties: { method: 'magic_link', email },
      })
      return NextResponse.redirect(new URL('/onboarding', origin))
    }

    const destination =
      user.user_type === 'landlord' ? '/landlord' :
      user.user_type === 'admin' ? '/admin' : '/profile'
    return NextResponse.redirect(new URL(destination, origin))
  } catch (err) {
    console.error('Auth callback error:', err)
    return NextResponse.redirect(new URL('/login?error=server_error', origin))
  }
}
