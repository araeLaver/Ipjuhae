'use client'

import { Button } from '@/components/ui/button'
import { Home, Shield, Share2, FileText, Star, CheckCircle, User } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-emerald-50/50 to-white dark:from-background dark:via-background dark:to-background" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative container mx-auto px-4 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              좋은 세입자임을
              <br />
              <span className="text-primary">증명하세요</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
              나만의 세입자 프로필을 만들어 집주인에게 신뢰를 전달하세요.
              간단한 프로필 생성만으로 원하는 집을 구할 확률을 높여보세요.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <Button size="xl" className="w-full sm:w-auto">
                  무료로 시작하기
                </Button>
              </Link>
              <Link href="/signup?type=landlord">
                <Button variant="outline" size="xl" className="w-full sm:w-auto">
                  집주인으로 가입
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right: Mock Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden md:block"
          >
            <div className="relative">
              {/* Floating badge */}
              <motion.div
                className="absolute -top-4 -right-4 bg-card rounded-xl shadow-elevated px-4 py-3 flex items-center gap-2 z-10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">신뢰점수 85점</span>
              </motion.div>

              {/* Card */}
              <div className="bg-card rounded-2xl shadow-elevated p-6 border border-border">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">김민수</p>
                    <p className="text-sm text-muted-foreground">30대 | 1인 가구</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="text-sm">재직 인증 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="text-sm">소득 인증 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">이전 집주인 추천 1건</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;조용하고 깔끔한 생활을 선호하는 직장인입니다.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
