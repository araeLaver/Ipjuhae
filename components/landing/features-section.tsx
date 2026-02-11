'use client'

import { Shield, FileText, Share2, CreditCard, Users, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Shield,
    title: '신뢰 프로필',
    description: '나이대, 가구형태, 라이프스타일 등 집주인이 궁금해하는 정보를 체계적으로 정리',
  },
  {
    icon: FileText,
    title: '자기소개서',
    description: '집주인에게 전달할 자기소개서를 작성하여 나만의 매력을 어필하세요',
  },
  {
    icon: Share2,
    title: '간편 공유',
    description: '완성된 프로필을 링크 하나로 집주인에게 전달, 채팅이나 문자로 쉽게 공유',
  },
  {
    icon: CreditCard,
    title: '인증 시스템',
    description: '재직, 소득, 신용 인증으로 객관적인 신뢰도를 증명할 수 있어요',
  },
  {
    icon: Users,
    title: '레퍼런스',
    description: '이전 집주인으로부터 추천을 받아 신뢰점수를 더 높여보세요',
  },
  {
    icon: BarChart3,
    title: '신뢰점수',
    description: '프로필 완성도와 인증에 기반한 점수로 신뢰도를 한눈에 보여줍니다',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">왜 입주해인가요?</h2>
          <p className="mt-3 text-muted-foreground">세입자와 집주인 모두를 위한 신뢰 플랫폼</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-6 rounded-xl border border-border hover:shadow-card hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
