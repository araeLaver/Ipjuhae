'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VerificationBadges } from '@/components/verification/verification-badge'
import { FavoriteButton } from '@/components/landlord/favorite-button'
import { Profile, Verification } from '@/types/database'
import { Shield, PawPrint, Cigarette, ChevronRight } from 'lucide-react'
import { getTrustScoreColor } from '@/lib/trust-score'

interface TenantListItemProps {
  profile: Profile & { verification?: Verification | null; user_id?: string }
  showFavorite?: boolean
}

export function TenantListItem({ profile, showFavorite = true }: TenantListItemProps) {
  const tenantUserId = profile.user_id

  return (
    <Link href={`/landlord/tenants/${profile.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Trust Score Badge */}
              <div className="text-center">
                <div className={`w-12 h-12 rounded-full ${getTrustScoreColor(profile.trust_score)} flex items-center justify-center`}>
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <p className="text-xs mt-1 font-medium">{profile.trust_score}점</p>
              </div>

              {/* Profile Info */}
              <div>
                <h3 className="font-semibold text-lg">{profile.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {profile.age_range} · {profile.family_type}
                </p>

                {/* Quick Info Badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.pets && profile.pets.length > 0 && !profile.pets.includes('없음') && (
                    <Badge variant="outline" className="text-xs">
                      <PawPrint className="h-3 w-3 mr-1" />
                      {profile.pets.join(', ')}
                    </Badge>
                  )}
                  <Badge variant={profile.smoking ? 'destructive' : 'outline'} className="text-xs">
                    <Cigarette className="h-3 w-3 mr-1" />
                    {profile.smoking ? '흡연' : '비흡연'}
                  </Badge>
                </div>

                {/* Verification Badges */}
                {profile.verification && (
                  <div className="mt-2">
                    <VerificationBadges verification={profile.verification} compact />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showFavorite && tenantUserId && (
                <FavoriteButton tenantId={tenantUserId} variant="icon" />
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
