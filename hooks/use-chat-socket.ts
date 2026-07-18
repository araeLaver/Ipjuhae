'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface Message {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender_name: string
  is_mine: boolean
}

interface UseChatSocketOptions {
  conversationId: string
  onMessage: (msg: Message) => void
  onTypingStart?: (userId: string) => void
  onTypingStop?: (userId: string) => void
}

interface SocketTokenResponse {
  token: string
  conversationId: string
  expiresIn: number
}

async function getSocketToken(conversationId: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch('/api/messages/socket-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ conversationId }),
    signal,
  })

  if (!response.ok) return null

  const data = await response.json() as Partial<SocketTokenResponse>
  if (typeof data.token !== 'string' || data.conversationId !== conversationId) {
    return null
  }

  return data.token
}

export function useChatSocket({
  conversationId,
  onMessage,
  onTypingStart,
  onTypingStop,
}: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [usingSSE, setUsingSSE] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const sseRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sseEnabledRef = useRef(false)
  const latestTsRef = useRef<string>(new Date().toISOString())
  const onMessageRef = useRef(onMessage)
  const onTypingStartRef = useRef(onTypingStart)
  const onTypingStopRef = useRef(onTypingStop)
  onMessageRef.current = onMessage
  onTypingStartRef.current = onTypingStart
  onTypingStopRef.current = onTypingStop

  // SSE 폴백 연결
  const connectSSE = useCallback(() => {
    if (!sseEnabledRef.current) return
    if (eventSourceRef.current) eventSourceRef.current.close()
    if (sseRetryRef.current) clearTimeout(sseRetryRef.current)

    const since = encodeURIComponent(latestTsRef.current)
    const es = new EventSource(
      `/api/messages/conversations/${conversationId}/stream?since=${since}`
    )
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      setIsConnected(true)
      setUsingSSE(true)
    })

    es.addEventListener('message', (e) => {
      const msg: Message = JSON.parse(e.data)
      latestTsRef.current = msg.created_at
      onMessageRef.current(msg)
    })

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      if (sseEnabledRef.current) {
        sseRetryRef.current = setTimeout(connectSSE, 3000)
      }
    }
  }, [conversationId])

  useEffect(() => {
    let disposed = false
    let refreshInFlight = false
    const abortController = new AbortController()
    sseEnabledRef.current = true

    const connectSocket = async () => {
      try {
        const token = await getSocketToken(conversationId, abortController.signal)
        if (disposed) return
        if (!token) {
          connectSSE()
          return
        }

        const socket = io({
          path: '/api/ws',
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        })
        socketRef.current = socket

        const fallBackToSSE = () => {
          socket.close()
          if (socketRef.current === socket) socketRef.current = null
          connectSSE()
        }

        const refreshSocketToken = async () => {
          if (disposed || refreshInFlight) return
          refreshInFlight = true
          try {
            const refreshedToken = await getSocketToken(conversationId, abortController.signal)
            if (disposed) return
            if (!refreshedToken) {
              fallBackToSSE()
              return
            }
            socket.auth = { token: refreshedToken }
            socket.connect()
          } catch (error) {
            if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
              fallBackToSSE()
            }
          } finally {
            refreshInFlight = false
          }
        }

        socket.on('connect', () => {
          eventSourceRef.current?.close()
          eventSourceRef.current = null
          if (sseRetryRef.current) clearTimeout(sseRetryRef.current)
          setIsConnected(true)
          setUsingSSE(false)
          socket.emit('join', conversationId)
        })

        socket.on('message', (msg: Message) => {
          latestTsRef.current = msg.created_at
          onMessageRef.current(msg)
        })

        socket.on('typing:start', (data: { userId: string }) => {
          onTypingStartRef.current?.(data.userId)
        })

        socket.on('typing:stop', (data: { userId: string }) => {
          onTypingStopRef.current?.(data.userId)
        })

        socket.on('disconnect', (reason) => {
          setIsConnected(false)
          if (reason === 'io server disconnect') {
            void refreshSocketToken()
          }
        })

        // Socket.IO 연결 실패 시 SSE 폴백
        socket.on('connect_error', (error) => {
          if (error.message === 'Invalid socket token') {
            void refreshSocketToken()
            return
          }
          fallBackToSSE()
        })
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          connectSSE()
        }
      }
    }

    void connectSocket()

    return () => {
      disposed = true
      sseEnabledRef.current = false
      abortController.abort()
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current)
      socketRef.current?.emit('leave', conversationId)
      socketRef.current?.close()
      socketRef.current = null
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [conversationId, connectSSE])

  const emitTypingStart = useCallback(() => {
    socketRef.current?.emit('typing:start', conversationId)
  }, [conversationId])

  const emitTypingStop = useCallback(() => {
    socketRef.current?.emit('typing:stop', conversationId)
  }, [conversationId])

  return {
    isConnected,
    usingSSE,
    emitTypingStart,
    emitTypingStop,
  }
}
