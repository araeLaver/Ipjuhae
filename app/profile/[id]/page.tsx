import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { queryOne, query } from '@/lib/db'
import { ProfileCard } from '@/components/profile/profile-card'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import Link from 'next/link'
import { Profile, Verification, ReferenceResponse } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const profile = await queryOne<Profile>(
    'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
    [id]
  )

  if (!profile) {
    return {
      title: '프로필을 찾을 수 없습니다',
      robots: { index: false },
    }
  }

  const title = `${profile.name}님의 세입자 프로필`
  const description = profile.bio
    ? `${profile.name} · ${profile.age_range} · ${profile.bio.slice(0, 80)}`
    : `${profile.name}님의 세입자 프로필을 입주해에서 확인하세요.`

  return {
    title,
    description,
    openGraph: {
      title: `${title} | 입주해`,
      description,
      type: 'profile',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params

  const profile = await queryOne<Profile>(
    'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
    [id]
  )

  if (!profile) {
    notFound()
  }

  const [verification, referenceResponses] = await Promise.all([
    queryOne<Verification>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [profile.user_id]
    ),
    query<ReferenceResponse>(
      `SELECT rr.* FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'`,
      [profile.user_id]
    ),
  ])

  const scoreBreakdown = calculateTrustScore({ profile, verification, referenceResponses })
  const profileWithScore = { ...profile, trust_score: scoreBreakdown.total }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-md animate-fade-in">
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">세입자 프로필</p>
            <h1 className="text-2xl font-bold">{profile.name}님의 프로필</h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">신뢰점수</CardTitle>
            </CardHeader>
            <CardContent>
              <TrustScoreChart
                total={scoreBreakdown.total}
                breakdown={scoreBreakdown}
              />
            </CardContent>
          </Card>

          <ProfileCard profile={profileWithScore} verification={verification} />

          <div className="bg-primary/5 p-4 rounded-lg text-center border border-primary/10">
            <p className="text-sm text-primary/80">
              이 프로필은{' '}
              <Link href="/" className="font-semibold underline">
                입주해
              </Link>
              에서 생성되었습니다.
            </p>
            <p className="text-xs text-primary/60 mt-1">
              신뢰할 수 있는 세입자 프로필을 만들어보세요.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
