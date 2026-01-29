'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Header } from '@/components/layout/header'
import { User, Building } from 'lucide-react'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'tenant' as 'tenant' | 'landlord',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (formData.password.length < 6) {
      newErrors.password = '비밀번호는 6자 이상이어야 합니다'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          userType: formData.userType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다')
      }

      toast.success('회원가입이 완료되었습니다!')

      if (formData.userType === 'landlord') {
        router.push('/landlord/onboarding')
      } else {
        router.push('/onboarding/basic')
      }
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>
              입주해에 가입하고 프로필을 만들어보세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="example@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                    setErrors((prev) => ({ ...prev, password: '' }))
                  }}
                  placeholder="6자 이상 입력"
                  error={errors.password}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    setErrors((prev) => ({ ...prev, confirmPassword: '' }))
                  }}
                  placeholder="비밀번호 재입력"
                  error={errors.confirmPassword}
                  required
                />
              </div>

              <div className="space-y-3">
                <Label>회원 유형</Label>
                <RadioGroup
                  value={formData.userType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, userType: value as 'tenant' | 'landlord' }))
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="tenant" id="tenant" className="peer sr-only" />
                    <Label
                      htmlFor="tenant"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/10 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                    >
                      <User className="mb-3 h-6 w-6" />
                      <span className="font-medium">세입자</span>
                      <span className="text-xs text-muted-foreground">집을 구하고 있어요</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="landlord" id="landlord" className="peer sr-only" />
                    <Label
                      htmlFor="landlord"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/10 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                    >
                      <Building className="mb-3 h-6 w-6" />
                      <span className="font-medium">집주인</span>
                      <span className="text-xs text-muted-foreground">세입자를 찾고 있어요</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button type="submit" className="w-full" loading={isLoading}>
                가입하기
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  로그인
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
