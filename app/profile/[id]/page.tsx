import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { queryOne, query } from '@/lib/db'
import { ProfileCard } from '@/components/profile/profile-card'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { VerificationBadges } from '@/components/verification/verification-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { ContactTenantButton } from '@/components/profile/contact-tenant-button'
import Link from 'next/link'
import { Star, ThumbsUp, MessageSquare } from 'lucide-react'
import { Profile, Verification, ReferenceResponse } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { formatDate } from '@/lib/date'

interface Props {
  params: Promise<{ id: string }>
}

interface ReferenceResponseWithDate extends ReferenceResponse {
  completed_at: string
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const profile = await queryOne<Profile>(
    'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
    [id]
  )

  if (!profile) {
    return {
      title: '프로필을 찾을 수 없습니다 | 렌트미',
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
      title: `${title} | 렌트미`,
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

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 5) * 100)
  const color =
    value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
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
    query<ReferenceResponseWithDate>(
      `SELECT rr.*, lr.completed_at
       FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'
       ORDER BY lr.completed_at DESC`,
      [profile.user_id]
    ),
  ])

  const scoreBreakdown = calculateTrustScore({ profile, verification, referenceResponses })
  const profileWithScore = { ...profile, trust_score: scoreBreakdown.total }

  const avgRating =
    referenceResponses.length > 0
      ? {
          rentPayment:
            referenceResponses.reduce((s, r) => s + r.rent_payment, 0) / referenceResponses.length,
          propertyCondition:
            referenceResponses.reduce((s, r) => s + r.property_condition, 0) /
            referenceResponses.length,
          neighborIssues:
            referenceResponses.reduce((s, r) => s + r.neighbor_issues, 0) /
            referenceResponses.length,
          checkoutCondition:
            referenceResponses.reduce((s, r) => s + r.checkout_condition, 0) /
            referenceResponses.length,
          recommendCount: referenceResponses.filter((r) => r.would_recommend).length,
        }
      : null

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-lg animate-fade-in">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">세입자 프로필</p>
            <h1 className="text-2xl font-bold">{profile.name}님의 프로필</h1>
            {referenceResponses.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">
                  레퍼런스 {referenceResponses.length}건
                </span>
                {avgRating && (
                  <span className="text-sm text-muted-foreground">
                    · 추천율{' '}
                    {Math.round((avgRating.recommendCount / referenceResponses.length) * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 신뢰점수 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">신뢰점수</CardTitle>
            </CardHeader>
            <CardContent>
              <TrustScoreChart total={scoreBreakdown.total} breakdown={scoreBreakdown} />
            </CardContent>
          </Card>

          {/* 인증 배지 */}
          {verification && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">인증 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <VerificationBadges verification={verification} />
              </CardContent>
            </Card>
          )}

          {/* 프로필 카드 */}
          <ProfileCard profile={profileWithScore} verification={verification} />

          {/* 레퍼런스 요약 */}
          {avgRating && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  집주인 평가 요약
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <RatingBar label="월세 납부" value={avgRating.rentPayment} />
                <RatingBar label="집 관리 상태" value={avgRating.propertyCondition} />
                <RatingBar label="이웃 분쟁 없음" value={avgRating.neighborIssues} />
                <RatingBar label="퇴거 후 상태" value={avgRating.checkoutCondition} />
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    재입주 추천
                  </div>
                  <Badge variant={avgRating.recommendCount > 0 ? 'default' : 'secondary'}>
                    {avgRating.recommendCount}/{referenceResponses.length}건
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 레퍼런스 코멘트 목록 */}
          {referenceResponses.some((r) => r.comment) && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  집주인 코멘트
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {referenceResponses
                  .filter((r) => r.comment)
                  .map((r) => {
                    const avg = Math.round(
                      (r.rent_payment +
                        r.property_condition +
                        r.neighbor_issues +
                        r.checkout_condition) /
                        4
                    )
                    return (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < avg
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(r.completed_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          &ldquo;{r.comment}&rdquo;
                        </p>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>
          )}

          {/* 연락하기 CTA */}
          <ContactTenantButton targetUserId={profile.user_id} targetName={profile.name} />

          {/* 푸터 배너 */}
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
