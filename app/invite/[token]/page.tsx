'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/invite/${token}`)
        const data = await res.json()
        if (res.ok && data.valid) {
          setEmail(data.email)
          if (data.signedUp) {
            setStatus('used')
          } else {
            setStatus('valid')
          }
        } else {
          setStatus('invalid')
        }
      } catch {
        setStatus('invalid')
      }
    }
    validateToken()
  }, [token])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">유효하지 않은 초대 링크</h1>
          <p className="text-gray-600 mb-8">
            이 초대 링크가 만료되었거나 유효하지 않습니다.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">홈으로 돌아가기</Link>
        </div>
      </div>
    )
  }

  if (status === 'used') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">이미 가입 완료</h1>
          <p className="text-gray-600 mb-8">
            이 초대 링크로 이미 가입하셨습니다. 로그인해 주세요.
          </p>
          <a
            href="/auth/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            로그인하기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">입주해 베타 초대</h1>
        <p className="text-gray-600 mb-2">초대를 받으셨습니다!</p>
        <p className="text-sm text-gray-500 mb-8">{email}</p>
        <button
          onClick={() => router.push(`/auth/signup?invite=${token}&email=${encodeURIComponent(email)}`)}
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 text-lg"
        >
          베타 서비스 가입하기
        </button>
        <p className="text-xs text-gray-400 mt-6">
          베타 기간 동안 프리미엄 기능 무료 이용
        </p>
      </div>
    </div>
  )
}
