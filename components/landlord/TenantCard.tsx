'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Shield, PawPrint, Cigarette, Star, CheckCircle } from 'lucide-react'
import { TenantCard as TenantCardType } from '@/hooks/useTenantSearch'
import { getTrustScoreColor } from '@/lib/trust-score'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrustScoreLabel(score: number): string {
  if (score >= 100) return '최우수'
  if (score >= 80) return '우수'
  if (score >= 60) return '양호'
  if (score >= 40) return '보통'
  return '초기'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TenantCardProps {
  tenant: TenantCardType
}

export function TenantCard({ tenant }: TenantCardProps) {
  const hasPets = tenant.pets.length > 0 && !tenant.pets.every((p) => p === '없음')
  const verifiedCount = [
    tenant.verified.employment,
    tenant.verified.income,
    tenant.verified.credit,
  ].filter(Boolean).length

  return (
    <Link href={`/landlord/tenants/${tenant.profile_id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Header: avatar placeholder + name + score */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Profile image or fallback */}
              <div
                className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${getTrustScoreColor(tenant.trust_score)}`}
              >
                {tenant.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.profile_image_url}
                    alt={tenant.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <Shield className="h-6 w-6 text-white" />
                )}
              </div>

              <div>
                <p className="font-semibold text-base leading-tight">{tenant.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tenant.age_range} · {tenant.family_type}
                </p>
              </div>
            </div>

            {/* Trust score chip */}
            <div className="text-right flex-shrink-0">
              <span className="text-lg font-bold">{tenant.trust_score}</span>
              <p className="text-xs text-muted-foreground">{getTrustScoreLabel(tenant.trust_score)}</p>
            </div>
          </div>

          {/* Trust score bar */}
          <Progress value={tenant.trust_score} max={120} className="h-1.5" />

          {/* Bio */}
          {tenant.bio && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {tenant.bio}
            </p>
          )}

          {/* Quick tags */}
          <div className="flex flex-wrap gap-1">
            {hasPets && (
              <Badge variant="outline" className="text-xs gap-1">
                <PawPrint className="h-3 w-3" />
                {tenant.pets.filter((p) => p !== '없음').join(', ')}
              </Badge>
            )}
            <Badge variant={tenant.smoking ? 'destructive' : 'outline'} className="text-xs gap-1">
              <Cigarette className="h-3 w-3" />
              {tenant.smoking ? '흡연' : '비흡연'}
            </Badge>
            {tenant.duration && (
              <Badge variant="outline" className="text-xs">
                {tenant.duration}
              </Badge>
            )}
            {tenant.noise_level && (
              <Badge variant="outline" className="text-xs">
                {tenant.noise_level}
              </Badge>
            )}
          </div>

          {/* Verification badges + reference count */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <div className="flex gap-1">
              {tenant.verified.employment && (
                <span className="text-xs text-emerald-600 flex items-center gap-0.5 font-medium">
                  <CheckCircle className="h-3 w-3" />재직
                </span>
              )}
              {tenant.verified.income && (
                <span className="text-xs text-blue-600 flex items-center gap-0.5 font-medium">
                  <CheckCircle className="h-3 w-3" />소득
                </span>
              )}
              {tenant.verified.credit && (
                <span className="text-xs text-violet-600 flex items-center gap-0.5 font-medium">
                  <CheckCircle className="h-3 w-3" />신용
                </span>
              )}
              {verifiedCount === 0 && (
                <span className="text-xs text-muted-foreground">인증 없음</span>
              )}
            </div>

            {tenant.reference_count > 0 && (
              <span className="text-xs text-amber-600 flex items-center gap-0.5 font-medium">
                <Star className="h-3 w-3 fill-amber-500" />
                레퍼런스 {tenant.reference_count}개
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
