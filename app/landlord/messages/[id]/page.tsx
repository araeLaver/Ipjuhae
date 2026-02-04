'use client'

import { useParams } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'
import { ChatRoom } from '@/components/messages/chat-room'

export default function LandlordChatPage() {
  const params = useParams()
  const conversationId = params.id as string

  return (
    <PageContainer maxWidth="md">
      <ChatRoom conversationId={conversationId} backPath="/landlord/messages" />
    </PageContainer>
  )
}
