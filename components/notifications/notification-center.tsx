'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck, MessageSquare, FileCheck, FileX, Star, Megaphone, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type NotificationType =
  | 'new_message'
  | 'reference_request'
  | 'reference_completed'
  | 'verification_approved'
  | 'verification_rejected'
  | 'trust_score_updated'
  | 'welcome'
  | 'admin_notice'

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

// ──────────────────────────────────────────────
// Icon map per type
// ──────────────────────────────────────────────
function NotificationIcon({ type, isRead }: { type: NotificationType; isRead: boolean }) {
  const base = 'h-8 w-8 rounded-full flex items-center justify-center shrink-0'
  const iconClass = 'h-4 w-4'

  const map: Record<NotificationType, { bg: string; icon: React.ReactNode }> = {
    new_message: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: <MessageSquare className={cn(iconClass, 'text-blue-500')} />,
    },
    reference_request: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      icon: <FileCheck className={cn(iconClass, 'text-purple-500')} />,
    },
    reference_completed: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: <FileCheck className={cn(iconClass, 'text-green-500')} />,
    },
    verification_approved: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      icon: <Check className={cn(iconClass, 'text-emerald-500')} />,
    },
    verification_rejected: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      icon: <FileX className={cn(iconClass, 'text-red-500')} />,
    },
    trust_score_updated: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      icon: <Star className={cn(iconClass, 'text-yellow-500')} />,
    },
    welcome: {
      bg: 'bg-primary/10',
      icon: <Gift className={cn(iconClass, 'text-primary')} />,
    },
    admin_notice: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      icon: <Megaphone className={cn(iconClass, 'text-orange-500')} />,
    },
  }

  const { bg, icon } = map[type] ?? map.admin_notice
  return (
    <div className={cn(base, bg, isRead && 'opacity-60')}>
      {icon}
    </div>
  )
}

// ──────────────────────────────────────────────
// Time formatter
// ──────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// ──────────────────────────────────────────────
// Single item
// ──────────────────────────────────────────────
function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const content = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
        !notification.is_read && 'bg-primary/5'
      )}
      onClick={() => !notification.is_read && onRead(notification.id)}
    >
      <NotificationIcon type={notification.type} isRead={notification.is_read} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium leading-tight', notification.is_read && 'text-muted-foreground')}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(notification.created_at)}</p>
      </div>
    </div>
  )

  return notification.link ? (
    <Link href={notification.link} className="block">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  )
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async (reset = true) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const cursor = reset ? '' : (nextCursor ?? '')
      const url = `/api/notifications?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      if (reset) {
        setNotifications(data.notifications)
      } else {
        setNotifications((prev) => [...prev, ...data.notifications])
      }
      setUnreadCount(data.unreadCount)
      setNextCursor(data.nextCursor)
    } finally {
      if (reset) setLoading(false)
      else setLoadingMore(false)
    }
  }, [nextCursor])

  // Poll unread count every 30s
  useEffect(() => {
    const pollCount = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1')
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.unreadCount)
        }
      } catch { /* silent */ }
    }
    pollCount()
    const interval = setInterval(pollCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch when opened
  useEffect(() => {
    if (open) fetchNotifications(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
  }

  const handleReadAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
    setUnreadCount(0)
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="알림"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border bg-popover shadow-elevated z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">
              알림
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {unreadCount}개 미읽음
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                모두 읽음
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="sm" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">알림이 없습니다</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={handleRead} />
                ))}
                {nextCursor && (
                  <div className="py-3 flex justify-center">
                    <button
                      onClick={() => fetchNotifications(false)}
                      disabled={loadingMore}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {loadingMore ? <Spinner size="sm" /> : '더 보기'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
