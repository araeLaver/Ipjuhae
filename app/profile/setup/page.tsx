'use client'

import { useRouter } from 'next/navigation'
import { TenantProfileForm } from '@/components/profile/tenant-profile-form'
import { PageContainer } from '@/components/layout/page-container'
import { Header } from '@/components/layout/header'

export default function ProfileSetupPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <PageContainer maxWidth="md">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">프로필 설정</h1>
              <p className="text-muted-foreground">
                원하는 조건을 입력하면 매칭을 시작할 수 있어요
              </p>
            </div>
            <TenantProfileForm
              onSaved={() => router.push('/profile')}
            />
          </div>
        </PageContainer>
      </main>
    </div>
  )
}
