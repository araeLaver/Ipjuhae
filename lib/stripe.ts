import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
// Runtime-only validation: build-time throw causes next build to fail locally and in CI
// without STRIPE_SECRET_KEY. isStripeEnabled() + route-level checks handle this at runtime.
if (!stripeSecretKey && process.env.NODE_ENV === 'production' && !process.env.SKIP_ENV_VALIDATION) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set — Stripe features will return 503')
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null

// Stripe Price IDs (set in .env or hardcode after creating in Stripe Dashboard)
export const STRIPE_PRICES = {
  basic: process.env.STRIPE_PRICE_BASIC || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
}

export function isStripeEnabled(): boolean {
  return !!stripe && !!STRIPE_PRICES.basic && !!STRIPE_PRICES.pro
}
