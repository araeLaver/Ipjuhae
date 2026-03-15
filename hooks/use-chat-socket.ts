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

function getAuthToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)auth-token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
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
  const latestTsRef = useRef<string>(new Date().toISOString())
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  // SSE 폴백 연결
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close()

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
      setTimeout(connectSSE, 3000)
    }
  }, [conversationId])

  useEffect(() => {
    const token = getAuthToken()
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

    socket.on('connect', () => {
      setIsConnected(true)
      setUsingSSE(false)
      socket.emit('join', conversationId)
    })

    socket.on('message', (msg: Message) => {
      onMessageRef.current(msg)
    })

    socket.on('typing:start', (data: { userId: string }) => {
      onTypingStart?.(data.userId)
    })

    socket.on('typing:stop', (data: { userId: string }) => {
      onTypingStop?.(data.userId)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Socket.IO 연결 실패 시 SSE 폴백
    socket.on('connect_error', () => {
      socket.close()
      connectSSE()
    })

    return () => {
      socket.emit('leave', conversationId)
      socket.close()
      eventSourceRef.current?.close()
    }
  }, [conversationId, connectSSE, onTypingStart, onTypingStop])

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
