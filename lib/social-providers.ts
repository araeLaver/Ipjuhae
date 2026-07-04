import { AuthProvider } from '@/types/database'

const AVAILABLE_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']
const DEFAULT_PROVIDERS: AuthProvider[] = ['kakao']

const envKeys = ['SOCIAL_AUTH_PROVIDERS', 'SOCIAL_PROVIDERS']

function parseProviders(raw?: string): AuthProvider[] {
  if (!raw) {
    return DEFAULT_PROVIDERS
  }

  const requested = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  const normalized = requested
    .filter((provider): provider is AuthProvider =>
      (AVAILABLE_PROVIDERS as readonly string[]).includes(provider)
    )

  return normalized.length > 0 ? normalized : DEFAULT_PROVIDERS
}

export function getEnabledSocialProviders(): AuthProvider[] {
  const publicKey = process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS
  const envProvider = envKeys
    .map((key) => process.env[key])
    .find(Boolean) || publicKey

  if (!envProvider) {
    return DEFAULT_PROVIDERS
  }

  return parseProviders(envProvider)
}

export function isSocialProviderEnabled(provider: string): provider is AuthProvider {
  return getEnabledSocialProviders().includes(provider as AuthProvider)
}
