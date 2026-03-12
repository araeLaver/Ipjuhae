'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Send, Building, User, Wifi, WifiOff } from 'lucide-react'
import { formatMessageDate, isToday, formatDate } from '@/lib/date'
import { toast } from 'sonner'
import Link from 'next/link'

interface Message {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender_name: string
  is_mine: boolean
}

interface OtherUser {
  id: string
  name: string
  type: 'landlord' | 'tenant'
}

interface ChatRoomProps {
  conversationId: string
  backPath: string // '/landlord/messages' or '/messages'
}

export function ChatRoom({ conversationId, backPath }: ChatRoomProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const latestTsRef = useRef<string>(new Date().toISOString())

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // 초기 메시지 로드 (REST)
  const fetchInitialMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) { router.push('/login'); return }
        if (response.status === 404) { router.push(backPath); return }
        throw new Error(data.error)
      }

      setMessages(data.messages)
      setOtherUser(data.conversation.otherUser)

      // SSE 기준 타임스탬프: 마지막 메시지 이후
      if (data.messages.length > 0) {
        latestTsRef.current = data.messages[data.messages.length - 1].created_at
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, router, backPath])

  // SSE 연결
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const since = encodeURIComponent(latestTsRef.current)
    const es = new EventSource(
      `/api/messages/conversations/${conversationId}/stream?since=${since}`
    )
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      setIsConnected(true)
    })

    es.addEventListener('message', (e) => {
      const msg: Message = JSON.parse(e.data)
      setMessages((prev) => {
        // 중복 방지
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      latestTsRef.current = msg.created_at
    })

    es.addEventListener('ping', () => {
      // keep-alive — no-op
    })

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      // 3초 후 재연결
      setTimeout(connectSSE, 3000)
    }
  }, [conversationId])

  useEffect(() => {
    fetchInitialMessages().then(() => {
      connectSSE()
    })
    return () => {
      eventSourceRef.current?.close()
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    const content = newMessage.trim()
    setNewMessage('') // 낙관적 UI — 입력창 즉시 비움

    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      // 내가 보낸 메시지는 REST 응답으로 즉시 반영 (SSE 중복 방지됨)
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev
        return [...prev, data.message]
      })
      latestTsRef.current = data.message.created_at
    } catch (err) {
      toast.error((err as Error).message)
      setNewMessage(content) // 실패 시 복원
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 날짜별 그룹화
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(message)
    return groups
  }, {} as Record<string, Message[]>)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className={`h-16 ${i % 2 === 0 ? 'ml-auto w-2/3' : 'w-2/3'} rounded-xl`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href={backPath}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              {otherUser && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={otherUser.name || '?'} size="sm" />
                    <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-background rounded-full">
                      {otherUser.type === 'landlord' ? (
                        <Building className="h-2.5 w-2.5 text-primary" />
                      ) : (
                        <User className="h-2.5 w-2.5 text-blue-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-base">{otherUser.name || '알 수 없음'}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {otherUser.type === 'landlord' ? '집주인' : '세입자'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 연결 상태 표시 */}
            <div
              className={`flex items-center gap-1 text-xs ${
                isConnected ? 'text-green-500' : 'text-muted-foreground'
              }`}
              title={isConnected ? '실시간 연결됨' : '연결 중...'}
            >
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">
                {isToday(date) ? '오늘' : formatDate(date)}
              </span>
              <div className="flex-1 border-t" />
            </div>

            <div className="space-y-3">
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] ${
                      message.is_mine
                        ? 'bg-primary text-primary-foreground rounded-l-xl rounded-tr-xl'
                        : 'bg-muted rounded-r-xl rounded-tl-xl'
                    } px-4 py-2`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        message.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatMessageDate(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <Card className="mt-auto">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
