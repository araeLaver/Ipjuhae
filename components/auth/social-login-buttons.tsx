'use client'

import { Button } from '@/components/ui/button'

interface SocialLoginButtonsProps {
  mode: 'login' | 'signup'
}

export function SocialLoginButtons({ mode }: SocialLoginButtonsProps) {
  const label = mode === 'login' ? '로그인' : '가입'

  const handleKakao = () => {
    window.location.href = '/api/auth/social/kakao'
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">또는</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full bg-[#FEE500] text-[#191919] border-[#FEE500] hover:bg-[#FDD800] hover:border-[#FDD800]"
        onClick={handleKakao}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor">
          <path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.63 1.76 4.96 4.42 6.3l-1.1 4.08c-.1.36.3.65.6.44l4.73-3.15c.44.05.89.08 1.35.08 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" />
        </svg>
        카카오로 {label}
      </Button>
    </div>
  )
}
