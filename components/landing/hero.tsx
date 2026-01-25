'use client'

import { Button } from '@/components/ui/button'
import { Home, Shield, Share2, FileText } from 'lucide-react'
import Link from 'next/link'

export function Hero() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <Home className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">입주해</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost">로그인</Button>
            </Link>
            <Link href="/signup">
              <Button>회원가입</Button>
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            좋은 세입자임을
            <br />
            <span className="text-primary">증명하세요</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            나만의 세입자 프로필을 만들어 집주인에게 신뢰를 전달하세요.
            <br />
            간단한 프로필 생성만으로 원하는 집을 구할 확률을 높여보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                무료로 시작하기
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <FeatureCard
            icon={<Shield className="h-10 w-10 text-primary" />}
            title="신뢰 프로필"
            description="나이대, 가구형태, 라이프스타일 등 집주인이 궁금해하는 정보를 체계적으로 정리"
          />
          <FeatureCard
            icon={<FileText className="h-10 w-10 text-primary" />}
            title="자기소개서"
            description="집주인에게 전달할 자기소개서를 작성하여 나만의 매력을 어필하세요"
          />
          <FeatureCard
            icon={<Share2 className="h-10 w-10 text-primary" />}
            title="간편 공유"
            description="완성된 프로필을 링크 하나로 집주인에게 전달, 채팅이나 문자로 쉽게 공유"
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
