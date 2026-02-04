'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { PropertyForm } from '@/components/landlord/property-form'
import { ArrowLeft } from 'lucide-react'

export default function NewPropertyPage() {
  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/landlord/properties">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">매물 등록</h1>
          <p className="text-muted-foreground">새로운 매물을 등록하세요</p>
        </div>

        <PropertyForm />
      </div>
    </PageContainer>
  )
}
