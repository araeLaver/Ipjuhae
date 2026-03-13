'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card text-center">
        <CardHeader>
          <CardTitle className="text-2xl">이메일을 확인해주세요</CardTitle>
          <CardDescription>
            로그인 링크를 보내드렸습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{email}</span>
              으로 발송된 링크를 확인해주세요.
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            링크를 클릭하면 자동으로 로그인됩니다.
          </p>

          <p className="text-xs text-muted-foreground">
            링크는 15분 동안 유효합니다.
          </p>

          <div className="pt-2">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                다른 이메일로 시도하기
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
