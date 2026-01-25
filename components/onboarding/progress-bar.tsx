'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

const steps = [
  { number: 1, label: '기본 정보' },
  { number: 2, label: '라이프스타일' },
  { number: 3, label: '완료' },
]

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  currentStep >= step.number
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {step.number}
              </div>
              <span
                className={cn(
                  'text-xs mt-1',
                  currentStep >= step.number
                    ? 'text-primary font-medium'
                    : 'text-gray-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-16 md:w-24 h-1 mx-2 transition-colors',
                  currentStep > step.number ? 'bg-primary' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
