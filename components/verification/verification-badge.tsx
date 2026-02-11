'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, Briefcase, DollarSign, CreditCard } from 'lucide-react'
import { Verification } from '@/types/database'

interface VerificationBadgeProps {
  type: 'employment' | 'income' | 'credit'
  verification: Verification | null
  showLabel?: boolean
}

const badgeConfig = {
  employment: {
    icon: Briefcase,
    label: '재직',
    verifiedLabel: '재직 인증',
  },
  income: {
    icon: DollarSign,
    label: '소득',
    verifiedLabel: '소득 인증',
  },
  credit: {
    icon: CreditCard,
    label: '신용',
    verifiedLabel: '신용 인증',
  },
}

export function VerificationBadge({ type, verification, showLabel = true }: VerificationBadgeProps) {
  const config = badgeConfig[type]
  const Icon = config.icon

  const isVerified = verification
    ? type === 'employment'
      ? verification.employment_verified
      : type === 'income'
      ? verification.income_verified
      : verification.credit_verified
    : false

  if (!isVerified) return null

  return (
    <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800">
      <CheckCircle className="h-3 w-3" />
      {showLabel && <span>{config.verifiedLabel}</span>}
      {!showLabel && <Icon className="h-3 w-3" />}
    </Badge>
  )
}

interface VerificationBadgesProps {
  verification: Verification | null
  compact?: boolean
}

export function VerificationBadges({ verification, compact = false }: VerificationBadgesProps) {
  if (!verification) return null

  const hasAnyVerification =
    verification.employment_verified ||
    verification.income_verified ||
    verification.credit_verified

  if (!hasAnyVerification) return null

  return (
    <div className="flex flex-wrap gap-1">
      <VerificationBadge type="employment" verification={verification} showLabel={!compact} />
      <VerificationBadge type="income" verification={verification} showLabel={!compact} />
      <VerificationBadge type="credit" verification={verification} showLabel={!compact} />
    </div>
  )
}
