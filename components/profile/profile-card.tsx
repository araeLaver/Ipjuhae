import { Profile } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  User,
  Users,
  PawPrint,
  Cigarette,
  Clock,
  Calendar,
  Volume2,
  Shield
} from 'lucide-react'

interface ProfileCardProps {
  profile: Profile
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getTrustScoreLabel = (score: number) => {
    if (score >= 80) return '높음'
    if (score >= 50) return '보통'
    return '시작'
  }

  const getStayTimeLabel = (value: string | null) => {
    const labels: Record<string, string> = {
      '아침': '주로 아침/오전',
      '저녁': '주로 저녁/밤',
      '주말만': '주말에만',
      '거의없음': '거의 없음',
    }
    return value ? labels[value] || value : '-'
  }

  const getDurationLabel = (value: string | null) => {
    const labels: Record<string, string> = {
      '6개월': '6개월 이내',
      '1년': '약 1년',
      '2년': '약 2년',
      '장기': '장기 거주',
    }
    return value ? labels[value] || value : '-'
  }

  const getNoiseLevelLabel = (value: string | null) => {
    const labels: Record<string, string> = {
      '조용': '조용한 편',
      '보통': '보통',
      '활발': '활발한 편',
    }
    return value ? labels[value] || value : '-'
  }

  return (
    <Card className="max-w-md mx-auto overflow-hidden">
      {/* Header with Trust Score */}
      <CardHeader className="bg-gradient-to-r from-primary to-blue-600 text-white pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{profile.name}</h2>
            <p className="text-blue-100">{profile.age_range} · {profile.family_type}</p>
          </div>
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full ${getTrustScoreColor(profile.trust_score)} flex items-center justify-center`}>
              <Shield className="h-8 w-8 text-white" />
            </div>
            <p className="text-xs mt-1">{getTrustScoreLabel(profile.trust_score)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Basic Info Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {profile.family_type}
          </Badge>
          {profile.pets && profile.pets.length > 0 && !profile.pets.includes('없음') && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <PawPrint className="h-3 w-3" />
              {profile.pets.join(', ')}
            </Badge>
          )}
          {profile.pets?.includes('없음') && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <PawPrint className="h-3 w-3" />
              반려동물 없음
            </Badge>
          )}
          <Badge variant={profile.smoking ? 'destructive' : 'secondary'} className="flex items-center gap-1">
            <Cigarette className="h-3 w-3" />
            {profile.smoking ? '흡연' : '비흡연'}
          </Badge>
        </div>

        {/* Lifestyle Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">라이프스타일</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">집에 있는 시간</p>
              <p className="font-medium">{getStayTimeLabel(profile.stay_time)}</p>
            </div>
            <div className="text-center">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">희망 거주기간</p>
              <p className="font-medium">{getDurationLabel(profile.duration)}</p>
            </div>
            <div className="text-center">
              <Volume2 className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">생활 패턴</p>
              <p className="font-medium">{getNoiseLevelLabel(profile.noise_level)}</p>
            </div>
          </div>
        </div>

        {/* Intro */}
        {profile.intro && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">자기소개</h3>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm leading-relaxed">{profile.intro}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
