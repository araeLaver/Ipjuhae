'use client'

import { useState, useEffect, useCallback } from 'react'
import { DocumentStatus } from '@/types/database'

interface DocumentStatusResult {
  id: string
  status: DocumentStatus
  reject_reason: string | null
}

export function useVerificationStatus(documentId: string | null, intervalMs = 5000) {
  const [status, setStatus] = useState<DocumentStatus | null>(null)
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!documentId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/verifications/documents/${documentId}`)
      if (!res.ok) return

      const data: DocumentStatusResult = await res.json()
      setStatus(data.status)
      setRejectReason(data.reject_reason)
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (!documentId) return

    fetchStatus()

    const id = setInterval(() => {
      if (status === 'approved' || status === 'rejected') return
      fetchStatus()
    }, intervalMs)

    return () => clearInterval(id)
  }, [documentId, intervalMs, fetchStatus, status])

  return { status, rejectReason, loading, refetch: fetchStatus }
}
