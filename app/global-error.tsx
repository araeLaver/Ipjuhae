'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-2xl font-bold mb-2">예상치 못한 오류가 발생했습니다</h1>
          <p className="text-muted-foreground mb-6 max-w-sm">
            오류가 자동으로 보고되었습니다. 잠시 후 다시 시도해주세요.
          </p>
          <Button onClick={reset}>다시 시도</Button>
        </div>
      </body>
    </html>
  )
}
