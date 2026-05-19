'use client'

import { useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'
import { ChatRoom } from '@/components/messages/chat-room'

export default function LandlordChatPage() {
  const params = useParams<{ id: string }>()
  const conversationId = params.id

  return (
    <PageContainer maxWidth="md">
      <ChatRoom conversationId={conversationId} backPath="/landlord/messages" />
    </PageContainer>
  )
}
