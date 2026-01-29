'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

export function CtaSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-r from-primary to-emerald-500 p-10 md:p-14 text-center text-white"
        >
          <h2 className="text-3xl md:text-4xl font-bold">지금 바로 시작하세요</h2>
          <p className="mt-4 text-lg text-white/80">
            무료로 프로필을 만들고, 원하는 집을 구할 확률을 높여보세요.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="xl" variant="secondary" className="w-full sm:w-auto bg-white text-primary hover:bg-white/90">
                무료 가입하기
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
