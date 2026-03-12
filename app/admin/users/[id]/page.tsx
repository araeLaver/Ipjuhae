import { notFound } from 'next/navigation'
import Link from 'next/link'
import TrustScoreEditor from './TrustScoreEditor'

interface UserDetail {
  id: string
  email: string
  name: string | null
  user_type: string
  created_at: string
  phone_number: string | null
  phone_verified: boolean
}

interface Profile {
  id: string
  name: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  noise_level: string | null
  duration: string | null
  trust_score: number
  is_complete: boolean
  bio: string | null
}

interface Verification {
  employment_verified: boolean
  income_verified: boolean
  credit_verified: boolean
}

interface Doc {
  id: string
  document_type: string
  file_name: string
  status: string
  created_at: string
}

interface Ref {
  id: string
  landlord_name: string | null
  landlord_phone: string
  status: string
  created_at: string
}

async function getUserDetail(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/users/${id}`, {
    cache: 'no-store',
    // Server-side fetch: admin guard는 layout에서 이미 통과
    // API에서도 guard하므로 쿠키 전달 필요
    credentials: 'include',
  })
  if (res.status === 404) return null
  return res.json() as Promise<{
    user: UserDetail
    profile: Profile | null
    verification: Verification | null
    documents: Doc[]
    references: Ref[]
  }>
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {ok ? '완료' : '미인증'}
    </span>
  )
}

function DocStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getUserDetail(id)
  if (!data) notFound()

  const { user, profile, verification, documents, references } = data

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{user.name ?? user.email}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {user.user_type}
        </span>
      </div>

      {/* 기본 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">이메일</dt><dd>{user.email}</dd>
          <dt className="text-gray-500">이름</dt><dd>{user.name ?? '—'}</dd>
          <dt className="text-gray-500">전화번호</dt>
          <dd>{user.phone_number ?? '—'} {user.phone_verified ? '✓' : ''}</dd>
          <dt className="text-gray-500">가입일</dt>
          <dd>{new Date(user.created_at).toLocaleDateString('ko-KR')}</dd>
        </dl>
      </section>

      {/* 프로필 + 신뢰점수 */}
      {profile && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">프로필</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <dt className="text-gray-500">연령대</dt><dd>{profile.age_range}</dd>
            <dt className="text-gray-500">가족형태</dt><dd>{profile.family_type}</dd>
            <dt className="text-gray-500">흡연</dt><dd>{profile.smoking ? '흡연' : '비흡연'}</dd>
            <dt className="text-gray-500">소음</dt><dd>{profile.noise_level ?? '—'}</dd>
            <dt className="text-gray-500">거주기간</dt><dd>{profile.duration ?? '—'}</dd>
            <dt className="text-gray-500">완성여부</dt><dd>{profile.is_complete ? '✅' : '❌'}</dd>
          </dl>
          <TrustScoreEditor userId={user.id} initialScore={profile.trust_score} />
        </section>
      )}

      {/* 인증 현황 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">인증 현황</h2>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">재직</span>
          <Badge ok={verification?.employment_verified ?? false} />
          <span className="text-gray-500 ml-3">소득</span>
          <Badge ok={verification?.income_verified ?? false} />
          <span className="text-gray-500 ml-3">신용</span>
          <Badge ok={verification?.credit_verified ?? false} />
        </div>
      </section>

      {/* 서류 */}
      {documents.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">제출 서류</h2>
          <div className="space-y-2">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{d.file_name}</span>
                <div className="flex items-center gap-3">
                  <DocStatus status={d.status} />
                  <Link
                    href={`/admin/documents?user=${user.id}`}
                    className="text-blue-600 text-xs hover:underline"
                  >
                    심사
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 레퍼런스 */}
      {references.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">집주인 레퍼런스</h2>
          <div className="space-y-2">
            {references.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {r.landlord_name ?? r.landlord_phone}
                </span>
                <DocStatus status={r.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
