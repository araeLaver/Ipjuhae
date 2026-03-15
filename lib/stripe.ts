import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is required in production')
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
