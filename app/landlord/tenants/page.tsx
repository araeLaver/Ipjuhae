import { PageContainer } from '@/components/layout/page-container'
import { TenantGrid } from '@/components/landlord/TenantGrid'

export default function TenantsPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">세입자 찾기</h1>
          <p className="text-muted-foreground">공개 동의된 확인 항목이 있는 세입자 프로필을 확인하세요</p>
        </div>

        <TenantGrid />
      </div>
    </PageContainer>
  )
}
