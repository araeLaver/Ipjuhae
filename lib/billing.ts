/** Configuration readiness is separate from an actual successful payment. */
export function billingReadiness(env: NodeJS.ProcessEnv = process.env) {
  const missing = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_BASIC',
    'STRIPE_PRICE_PRO',
    'STRIPE_WEBHOOK_SECRET',
  ].filter((key) => !env[key])
  if (
    env.NODE_ENV === 'production' &&
    env.STRIPE_SECRET_KEY &&
    !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY)
  )
    missing.push('STRIPE_LIVE_KEY_REQUIRED')
  return { ready: missing.length === 0, missing }
}

export function billingReturnUrl() {
  const url = new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.ipjuhae.com',
  )
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw Error('INVALID_BILLING_ORIGIN')
  return `${url.origin}/landlord/subscription`
}
