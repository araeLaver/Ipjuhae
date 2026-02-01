'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Mail, Phone, Link2 } from 'lucide-react'
import Link from 'next/link'

interface AccountInfo {
  email: string
  auth_provider: string | null
  phone_verified: boolean
}

const providerLabels: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: '구글',
}

export function AccountStatus() {
  const [account, setAccount] = useState<AccountInfo | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const data = await res.json()
        setAccount({
          email: data.user.email,
          auth_provider: data.user.auth_provider,
          phone_verified: data.user.phone_verified,
        })
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  if (!account) return null

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">계정 상태</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{account.email}</span>
          </div>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>

        {/* Social */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span>소셜 연동</span>
          </div>
          {account.auth_provider ? (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {providerLabels[account.auth_provider] || account.auth_provider}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">미연동</span>
          )}
        </div>

        {/* Phone */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>휴대폰 인증</span>
          </div>
          {account.phone_verified ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Link href="/verify-phone" className="text-xs text-primary hover:underline">
              인증하기
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
