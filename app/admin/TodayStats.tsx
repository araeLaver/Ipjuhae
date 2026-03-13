'use client'

import { useState, useEffect, useCallback } from 'react'

interface TodayStatsData {
  newProfiles: number
  newListings: number
  date: string
}

export default function TodayStats() {
  const [data, setData] = useState<TodayStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/stats/today', { cache: 'no-store' })
      if (!res.ok) throw new Error('통계 조회 실패')
      const json: TodayStatsData = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const cards = data
    ? [
        {
          label: '오늘 신규 프로필',
          value: data.newProfiles,
          color: 'bg-teal-50 text-teal-700',
        },
        {
          label: '오늘 신규 리스팅',
          value: data.newListings,
          color: 'bg-orange-50 text-orange-700',
        },
      ]
    : []

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">
          오늘자 신규 현황{data ? ` (${data.date} KST)` : ''}
        </h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                     text-gray-600 bg-white border border-gray-200 rounded-lg
                     hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          새로고침
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="rounded-xl p-5 bg-gray-100 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cards.map(c => (
            <div key={c.label} className={`rounded-xl p-5 ${c.color}`}>
              <p className="text-sm font-medium opacity-70">{c.label}</p>
              <p className="text-3xl font-bold mt-1">{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
