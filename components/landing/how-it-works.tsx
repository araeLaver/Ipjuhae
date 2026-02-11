'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    number: 1,
    title: '회원가입',
    description: '이메일로 간단하게 가입하세요. 세입자 또는 집주인으로 시작할 수 있어요.',
  },
  {
    number: 2,
    title: '프로필 작성',
    description: '기본 정보와 라이프스타일을 입력하고 자기소개서를 작성하세요.',
  },
  {
    number: 3,
    title: '공유하기',
    description: '완성된 프로필 링크를 집주인에게 보내 신뢰를 전달하세요.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">어떻게 사용하나요?</h2>
          <p className="mt-3 text-muted-foreground">3단계로 간단하게</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex-1 relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                    {step.number}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-primary/20" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
