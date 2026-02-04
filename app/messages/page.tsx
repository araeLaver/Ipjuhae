'use client'

import { PageContainer } from '@/components/layout/page-container'
import { ConversationList } from '@/components/messages/conversation-list'

export default function TenantMessagesPage() {
  return (
    <PageContainer maxWidth="md">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">메시지</h1>
        <ConversationList basePath="/messages" />
      </div>
    </PageContainer>
  )
}
