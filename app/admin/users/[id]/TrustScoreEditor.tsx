'use client'

import { useState } from 'react'

interface Props {
  userId: string
  initialScore: number
}

export default function TrustScoreEditor({ userId, initialScore }: Props) {
  const [score, setScore] = useState(initialScore)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/admin/users/${userId}/trust-score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, reason }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-xs text-gray-500 mb-2">신뢰점수 수동 조정</p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={e => setScore(Number(e.target.value))}
          className="w-40"
        />
        <span className="text-sm font-semibold w-8 text-right">{score}</span>
        <input
          type="text"
          placeholder="조정 사유"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
