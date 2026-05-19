import Link from 'next/link'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <Home className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          주소가 변경되었거나 삭제된 페이지입니다.
        </p>
      </div>
      <Link href="/">
        <Button>홈으로 이동</Button>
      </Link>
    </div>
  )
}
