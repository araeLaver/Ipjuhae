import { AuthProvider } from '@/types/database'

interface OAuthConfig {
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  profileUrl: string
  scope: string
}

const providers: Record<AuthProvider, () => OAuthConfig> = {
  kakao: () => ({
    clientId: process.env.KAKAO_CLIENT_ID || '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profileUrl: 'https://kapi.kakao.com/v2/user/me',
    scope: 'profile_nickname profile_image account_email',
  }),
  naver: () => ({
    clientId: process.env.NAVER_CLIENT_ID || '',
    clientSecret: process.env.NAVER_CLIENT_SECRET || '',
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profileUrl: 'https://openapi.naver.com/v1/nid/me',
    scope: '',
  }),
  google: () => ({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'openid email profile',
  }),
}

export function getOAuthConfig(provider: AuthProvider): OAuthConfig {
  return providers[provider]()
}

function getRedirectUri(provider: AuthProvider): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  return `${base}/api/auth/social/${provider}/callback`
}

export function getAuthorizeUrl(provider: AuthProvider): string {
  const config = getOAuthConfig(provider)
  const redirectUri = getRedirectUri(provider)
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })

  if (config.scope) {
    params.set('scope', config.scope)
  }

  return `${config.authorizeUrl}?${params.toString()}`
}

export async function exchangeCode(provider: AuthProvider, code: string): Promise<string> {
  const config = getOAuthConfig(provider)
  const redirectUri = getRedirectUri(provider)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code,
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`)
  }

  const data = await res.json()
  return data.access_token
}

export interface SocialProfile {
  id: string
  email: string | null
  name: string | null
  profileImage: string | null
}

export async function getProfile(provider: AuthProvider, accessToken: string): Promise<SocialProfile> {
  const config = getOAuthConfig(provider)

  const res = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status}`)
  }

  const data = await res.json()

  switch (provider) {
    case 'kakao':
      return {
        id: String(data.id),
        email: data.kakao_account?.email || null,
        name: data.kakao_account?.profile?.nickname || null,
        profileImage: data.kakao_account?.profile?.profile_image_url || null,
      }
    case 'naver':
      return {
        id: data.response?.id || '',
        email: data.response?.email || null,
        name: data.response?.name || null,
        profileImage: data.response?.profile_image || null,
      }
    case 'google':
      return {
        id: data.id || '',
        email: data.email || null,
        name: data.name || null,
        profileImage: data.picture || null,
      }
  }
}
