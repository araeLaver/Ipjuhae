import { Home } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            <span className="font-semibold">입주해</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">로그인</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">회원가입</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} 입주해. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
