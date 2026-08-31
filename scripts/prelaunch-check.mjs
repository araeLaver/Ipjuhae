#!/usr/bin/env node
/* eslint-disable no-console */

function requireEnv(name, message = `${name} is required`) {
  const value = process.env[name]
  if (!value) {
    return `${message}`
  }
  return null
}

function validateLength(name, minLength) {
  const value = process.env[name] || ''
  if (value.length < minLength) {
    return `${name} should be at least ${minLength} characters`
  }
  return null
}

function collectFailure(failures, message) {
  if (message) failures.push(message)
}

const launchCheckMode = process.env.LAUNCH_CHECK_MODE === 'dry-run' ? 'dry-run' : 'production'

function validateNotPlaceholder(name) {
  if (launchCheckMode === 'dry-run') return null

  const value = process.env[name] || ''
  const normalized = value.toLowerCase()
  const placeholderMarkers = [
    'placeholder',
    'not-a-real',
    'replace-with',
    'your-',
    'your_',
    'example.invalid',
    'localhost',
  ]

  if (placeholderMarkers.some((marker) => normalized.includes(marker))) {
    return `${name} looks like a placeholder; use an approved production value or run launch:check:dry-run`
  }

  return null
}

function validateProviders() {
  const failures = []

  // Core env
  const coreChecks = [
    ['DATABASE_URL', 'DATABASE_URL is required for production DB access'],
    ['DB_SCHEMA', 'DB_SCHEMA is required'],
    ['JWT_SECRET', 'JWT_SECRET is required'],
    ['DISCLOSURE_SIGNING_KEY', 'DISCLOSURE_SIGNING_KEY is required for trust disclosure packages'],
    ['CRON_SECRET', 'CRON_SECRET is required for /api/cron'],
    ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_APP_URL is required'],
    ['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_BASE_URL is required'],
  ]

  coreChecks.forEach(([name, message]) => collectFailure(failures, requireEnv(name, message)))
  collectFailure(failures, validateLength('JWT_SECRET', 32))
  collectFailure(failures, validateLength('DISCLOSURE_SIGNING_KEY', 32))
  coreChecks.forEach(([name]) => collectFailure(failures, validateNotPlaceholder(name)))

  // SMS provider must be real in production
  const smsProvider = process.env.SMS_PROVIDER
  if (smsProvider !== 'nhn' && smsProvider !== 'twilio') {
    collectFailure(failures, 'SMS_PROVIDER must be nhn or twilio')
  } else if (smsProvider === 'nhn') {
    collectFailure(failures, requireEnv('NHN_SMS_APP_KEY', 'NHN_SMS_APP_KEY is required for SMS_PROVIDER=nhn'))
    collectFailure(failures, requireEnv('NHN_SMS_SECRET_KEY', 'NHN_SMS_SECRET_KEY is required for SMS_PROVIDER=nhn'))
    collectFailure(failures, requireEnv('NHN_SMS_SENDER', 'NHN_SMS_SENDER is required for SMS_PROVIDER=nhn'))
    ;['NHN_SMS_APP_KEY', 'NHN_SMS_SECRET_KEY', 'NHN_SMS_SENDER'].forEach((name) =>
      collectFailure(failures, validateNotPlaceholder(name))
    )
  } else if (smsProvider === 'twilio') {
    collectFailure(failures, requireEnv('TWILIO_ACCOUNT_SID', 'TWILIO_ACCOUNT_SID is required for SMS_PROVIDER=twilio'))
    collectFailure(failures, requireEnv('TWILIO_AUTH_TOKEN', 'TWILIO_AUTH_TOKEN is required for SMS_PROVIDER=twilio'))
    collectFailure(failures, requireEnv('TWILIO_PHONE_NUMBER', 'TWILIO_PHONE_NUMBER is required for SMS_PROVIDER=twilio'))
    ;['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'].forEach((name) =>
      collectFailure(failures, validateNotPlaceholder(name))
    )
  }

  // Email: either provider-based or SMTP transport can be used
  const emailProvider = process.env.EMAIL_PROVIDER
  const canUseEmailProvider = emailProvider === 'resend' || emailProvider === 'sendgrid'
  const canUseSmtp =
    !!process.env.SMTP_HOST &&
    !!process.env.SMTP_USER &&
    !!process.env.SMTP_PASS

  if (!canUseEmailProvider && !canUseSmtp) {
    collectFailure(
      failures,
      'EMAIL_PROVIDER must be resend/sendgrid or SMTP_HOST/SMTP_USER/SMTP_PASS must be set for Magic Link'
    )
  } else if (emailProvider && !canUseEmailProvider) {
    collectFailure(failures, 'EMAIL_PROVIDER must be resend or sendgrid')
  }

  if (emailProvider === 'resend') {
    collectFailure(failures, requireEnv('RESEND_API_KEY', 'RESEND_API_KEY is required for EMAIL_PROVIDER=resend'))
    collectFailure(failures, validateNotPlaceholder('RESEND_API_KEY'))
  }
  if (emailProvider === 'sendgrid') {
    collectFailure(failures, requireEnv('SENDGRID_API_KEY', 'SENDGRID_API_KEY is required for EMAIL_PROVIDER=sendgrid'))
    collectFailure(failures, validateNotPlaceholder('SENDGRID_API_KEY'))
  }
  ;['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].forEach((name) => {
    if (process.env[name]) collectFailure(failures, validateNotPlaceholder(name))
  })

  // File storage
  const storageProvider = process.env.STORAGE_PROVIDER
  if (storageProvider !== 's3') {
    collectFailure(failures, 'STORAGE_PROVIDER must be s3 for production')
  }
  collectFailure(failures, requireEnv('S3_BUCKET', 'S3_BUCKET is required for production storage'))
  collectFailure(
    failures,
    requireEnv('S3_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID is required for production storage')
  )
  collectFailure(
    failures,
    requireEnv('S3_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY is required for production storage')
  )
  ;['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].forEach((name) =>
    collectFailure(failures, validateNotPlaceholder(name))
  )

  // Verification provider
  const verificationProvider = process.env.VERIFICATION_PROVIDER
  if (verificationProvider !== 'codef' && verificationProvider !== 'nice') {
    collectFailure(failures, 'VERIFICATION_PROVIDER must be codef or nice')
  }
  if (verificationProvider === 'codef') {
    collectFailure(failures, requireEnv('CODEF_CLIENT_ID', 'CODEF_CLIENT_ID is required for VERIFICATION_PROVIDER=codef'))
    collectFailure(
      failures,
      requireEnv('CODEF_CLIENT_SECRET', 'CODEF_CLIENT_SECRET is required for VERIFICATION_PROVIDER=codef')
    )
    collectFailure(
      failures,
      requireEnv('CODEF_PUBLIC_KEY', 'CODEF_PUBLIC_KEY is required for VERIFICATION_PROVIDER=codef')
    )
    ;['CODEF_CLIENT_ID', 'CODEF_CLIENT_SECRET', 'CODEF_PUBLIC_KEY'].forEach((name) =>
      collectFailure(failures, validateNotPlaceholder(name))
    )
  }
  if (verificationProvider === 'nice') {
    collectFailure(
      failures,
      requireEnv('NICE_CLIENT_ID', 'NICE_CLIENT_ID is required for VERIFICATION_PROVIDER=nice')
    )
    collectFailure(
      failures,
      requireEnv('NICE_CLIENT_SECRET', 'NICE_CLIENT_SECRET is required for VERIFICATION_PROVIDER=nice')
    )
    ;['NICE_CLIENT_ID', 'NICE_CLIENT_SECRET'].forEach((name) =>
      collectFailure(failures, validateNotPlaceholder(name))
    )
  }

  // Optional hard-fail for webhook mode consistency
  collectFailure(
    failures,
    process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET
      ? 'STRIPE_SECRET_KEY set but STRIPE_WEBHOOK_SECRET is missing'
      : null
  )

  return failures
}

function main() {
  const failures = validateProviders()

  if (failures.length > 0) {
    console.error('❌ launch:check failed')
    failures.forEach((item) => console.error(` - ${item}`))
    process.exit(1)
  }

  console.info(`✅ launch:check passed (${launchCheckMode})`)
  if (launchCheckMode === 'dry-run') {
    console.info('ℹ️ dry-run uses non-secret placeholders and does not prove production credentials are configured')
  }
  process.exit(0)
}

main()
