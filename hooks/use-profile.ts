'use client'

import { useEffect, useState, useCallback } from 'react'
import { Profile } from '@/types/database'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/profile')

      if (response.status === 401) {
        setProfile(null)
        return
      }

      if (!response.ok) {
        throw new Error('프로필을 불러오는데 실패했습니다')
      }

      const data = await response.json()
      setProfile(data.profile)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('프로필 업데이트에 실패했습니다')
      }

      const data = await response.json()
      setProfile(data.profile)
      return data.profile as Profile
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }

  return {
    profile,
    loading,
    error,
    refresh: loadProfile,
    updateProfile,
  }
}
