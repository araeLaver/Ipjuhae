'use client'

import { Progress } from '@/components/ui/progress'

interface TrustScoreChartProps {
  total: number
  breakdown: {
    profile: number
    employment: number
    income: number
    credit: number
    reference: number
    validation: number
    disputePenalty: number
    propertySafety: number
  }
}

const categories = [
  { key: 'profile' as const, label: '프로필 완성', max: 20, color: 'bg-teal-500' },
  { key: 'employment' as const, label: '재직 인증', max: 25, color: 'bg-blue-500' },
  { key: 'income' as const, label: '소득 인증', max: 25, color: 'bg-indigo-500' },
  { key: 'credit' as const, label: '신용 관련 확인', max: 20, color: 'bg-purple-500' },
  { key: 'reference' as const, label: '레퍼런스', max: 30, color: 'bg-amber-500' },
  { key: 'validation' as const, label: '서류 검증', max: 15, color: 'bg-emerald-500' },
  { key: 'disputePenalty' as const, label: '분쟁 페널티', max: 30, color: 'bg-red-500' },
  { key: 'propertySafety' as const, label: '주거 안전', max: 10, color: 'bg-cyan-500' },
]

export function TrustScoreChart({ total, breakdown }: TrustScoreChartProps) {
  const maxScore = 145
  const percentage = Math.min(100, (total / maxScore) * 100)
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="space-y-6">
      {/* Circular Progress */}
      <div className="flex justify-center">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="10"
            />
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 70 70)"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{total}</span>
            <span className="text-xs text-muted-foreground">/ {maxScore}</span>
          </div>
        </div>
      </div>

      {/* Category Bars */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const rawValue = breakdown[cat.key]
          const isPenalty = cat.key === 'disputePenalty'
          const value = isPenalty ? Math.min(0, rawValue) : Math.max(0, rawValue)
          const barValue = isPenalty ? -value : value
          const labelValue = isPenalty && value < 0 ? value : value
          return (
            <div key={cat.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{cat.label}</span>
                <span className="font-medium">
                  {labelValue}
                  <span className="text-muted-foreground">/{cat.max}</span>
                </span>
              </div>
              <Progress
                value={barValue}
                max={cat.max}
                indicatorClassName={cat.color}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
