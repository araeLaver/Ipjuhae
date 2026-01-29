'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

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
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  currentStep > step.number
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === step.number
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {currentStep > step.number ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-2 transition-colors',
                  currentStep >= step.number
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="relative w-16 md:w-24 h-1 mx-2">
                <div className="absolute inset-0 bg-muted rounded-full" />
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500',
                    currentStep > step.number ? 'w-full' : 'w-0'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
