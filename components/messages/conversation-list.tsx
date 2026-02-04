'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquare, Building, User } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/date'
import { toast } from 'sonner'

interface Conversation {
  id: string
  landlord_id: string
  tenant_id: string
  last_message_at: string
  other_user_name: string
  other_user_id: string
  other_user_type: 'landlord' | 'tenant'
  last_message: string | null
  unread_count: number
}

interface ConversationListProps {
  basePath: string // '/landlord/messages' or '/messages'
}

export function ConversationList({ basePath }: ConversationListProps) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/messages/conversations')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data.error)
      }

      setConversations(data.conversations)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-12 w-12" />}
        title="대화가 없습니다"
        description="세입자 프로필에서 메시지를 보내 대화를 시작하세요."
      />
    )
  }

  return (
    <div className="space-y-3">
      {conversations.map(conversation => (
        <Card
          key={conversation.id}
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push(`${basePath}/${conversation.id}`)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar name={conversation.other_user_name || '?'} size="md" />
                <div className="absolute -bottom-1 -right-1 p-0.5 bg-background rounded-full">
                  {conversation.other_user_type === 'landlord' ? (
                    <Building className="h-3 w-3 text-primary" />
                  ) : (
                    <User className="h-3 w-3 text-blue-500" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">
                    {conversation.other_user_name || '알 수 없음'}
                  </h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(conversation.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.last_message || '새 대화'}
                  </p>
                  {conversation.unread_count > 0 && (
                    <Badge variant="default" className="rounded-full min-w-[20px] h-5 flex items-center justify-center">
                      {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
