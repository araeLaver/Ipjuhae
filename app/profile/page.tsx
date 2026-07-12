'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Edit, FileText, Eye, Shield, Users } from 'lucide-react'
import { calculateTrustScore } from '@/lib/trust-score'
import { Profile, Verification } from '@/types/database'
import { PageContainer } from '@/components/layout/page-container'
import { ProfileCard } from '@/components/profile/profile-card'
import { ShareButton } from '@/components/profile/share-button'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { ProfileImageUpload } from '@/components/profile/profile-image-upload'
import { AccountStatus } from '@/components/profile/account-status'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile')
        if (response.status === 401) {
          router.push('/login')
          return
        }
        const data = await response.json()

        if (!data.profile || !data.profile.is_complete) {
          router.push('/onboarding/basic')
          return
        }

        setProfile(data.profile)
        setVerification(data.verification || null)
        setProfileImage(data.profileImage || null)
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  if (loading) {
    return (
      <PageContainer maxWidth="sm">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </PageContainer>
    )
  }

  if (!profile) return null

  const scoreBreakdown = calculateTrustScore({ profile, verification })

  return (
    <PageContainer maxWidth="sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">Profile</h1>
        <AccountStatus />

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <ProfileImageUpload name={profile.name} imageUrl={profileImage} onImageChange={setProfileImage} />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Trust score</CardTitle>
          </CardHeader>
          <CardContent>
            <TrustScoreChart total={scoreBreakdown.total} breakdown={scoreBreakdown} />
          </CardContent>
        </Card>

        <ProfileCard profile={profile} verification={verification} profileImage={profileImage} />
        <ShareButton profileId={profile.id} />

        <div className="space-y-3">
          <Link href="/profile/verification">
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Verification settings
              <span className="ml-auto text-sm text-muted-foreground">Status and documents</span>
            </Button>
          </Link>

          <Link href="/profile/reference">
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              Reference requests
              <span className="ml-auto text-sm text-muted-foreground">Manage tenant reference workflow</span>
            </Button>
          </Link>

          <Link href="/profile/consent">
            <Button variant="outline" className="w-full justify-start">
              <Eye className="h-4 w-4 mr-2" />
              Consent settings
              <span className="ml-auto text-sm text-muted-foreground">Manage active consent fields</span>
            </Button>
          </Link>

          <Link href="/profile/consent/events">
            <Button variant="outline" className="w-full justify-start">
              <Eye className="h-4 w-4 mr-2" />
              Consent event history
              <span className="ml-auto text-sm text-muted-foreground">Granted and revoked logs</span>
            </Button>
          </Link>

          <Link href="/profile/access-logs">
            <Button variant="outline" className="w-full justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Access logs
              <span className="ml-auto text-sm text-muted-foreground">Who viewed which data</span>
            </Button>
          </Link>
        </div>

        <div className="pt-4">
          <Link href="/profile/edit">
            <Button variant="outline" className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              Edit basic profile
            </Button>
          </Link>
        </div>

        <AccountDeleteSection />
      </div>
    </PageContainer>
  )
}

function AccountDeleteSection() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to delete account.')
        return
      }
      router.push('/login?deleted=1')
    } catch {
      setError('Could not process account deletion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete my account</AlertDialogTitle>
          <AlertDialogDescription>
            Deleting your account removes profile data, chat history and associated assets. This is not recoverable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
