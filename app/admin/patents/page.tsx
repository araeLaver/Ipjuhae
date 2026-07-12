'use client'

import { useEffect, useMemo, useState } from 'react'

interface PatentDoc {
  id: string
  file_name: string
  relative_path: string
  stage: string
  filing_number: string | null
  filing_date: string | null
  kind: string
  extension: string
  size_bytes: number
  updated_at: string
}

const KIND_LABEL: Record<string, string> = {
  claims: '청구항',
  patent_application: '특허출원서',
  specification: '명세서',
  payment_receipt: '납부확인증',
  filing_notice: '출원번호통지서',
  invention_description: '발명설명',
  technology_spec: '기술구성상세',
  service_engine: '서비스엔진운영설명서',
  document: '기타',
}

const STAGE_LABEL: Record<string, string> = {
  임시초안: '임시초안',
  전달문서: '전달문서',
  받은문서: '받은문서',
  unclassified: '미분류',
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${value} B`
}

export default function PatentDocumentsPage() {
  const [docs, setDocs] = useState<PatentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const res = await fetch('/api/admin/patent-documents')
      const payload = await res.json()

      if (!res.ok) {
        setError(payload.error ?? 'failed to load')
        setDocs([])
        setLoading(false)
        return
      }

      setDocs(payload.documents ?? [])
      setLoading(false)
    }

    load()
  }, [])

  const stages = useMemo(() => {
    const set = new Set(docs.map(d => d.stage))
    return ['all', ...Array.from(set.values())]
  }, [docs])

  const kinds = useMemo(() => {
    const set = new Set(docs.map(d => d.kind))
    return ['all', ...Array.from(set.values())]
  }, [docs])

  const list = useMemo(() => {
    return docs.filter(d => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false
      return true
    })
  }, [docs, stageFilter, kindFilter])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">특허/출원 문서</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="rounded border border-gray-300 p-2 text-sm"
        >
          {stages.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value)}
          className="rounded border border-gray-300 p-2 text-sm"
        >
          {kinds.map(value => (
            <option key={value} value={value}>
              {value === 'all' ? '전체유형' : (KIND_LABEL[value] ?? value)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500">표시할 문서가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {list.map(doc => {
            const label = KIND_LABEL[doc.kind] ?? doc.kind
            const download = `/api/admin/patent-documents/download?path=${encodeURIComponent(doc.relative_path)}`
            const updated = new Date(doc.updated_at).toLocaleString('ko-KR')

            return (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{doc.file_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      구분: {label} | 단계: {STAGE_LABEL[doc.stage] ?? doc.stage} | 출원번호: {doc.filing_number ?? '미확인'} | 출원일: {doc.filing_date ?? '미확인'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      크기: {formatBytes(doc.size_bytes)} | 수정일: {updated}
                    </p>
                  </div>

                  <a
                    href={download}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    원문 열기
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
