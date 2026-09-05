'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FeatureRequestForm } from '@/components/feedback/feature-request-form'

// 디자인 기준: claude.ai 디자인 시안 '입주해 사전 대기열'
// 딥 블루 #0C2247 + 앰버 포인트 #E9A23B, Pretendard, 모바일 우선 원페이지
const NAVY = '#0C2247'
const AMBER = '#E9A23B'

// 히어로 카피 후보 (디자인 시안 A/B/C — 기본 B)
// A: "계약서에 도장 찍기 전에, 서로를 확인하세요"
// C: "임대차 거래의 불신을 끝냅니다"
const HEADLINE = ['믿을 만한 세입자인지, 믿을 만한 집인지.', '이제 확인할 수 있습니다']

const COUNT_DISPLAY_THRESHOLD = 30

type Role = 'tenant' | 'landlord' | 'agent'

const ROLE_LABEL: Record<Role, string> = {
  tenant: '임차인',
  landlord: '임대인',
  agent: '공인중개사',
}

const ROLE_DETAILS: Record<Role, { benefits: string[] }> = {
  tenant: {
    benefits: [
      '한 번 인증하면 여러 집에 재사용할 수 있어요',
      '학력이나 직장 이름 같은 건 요구하지 않아요',
      '발급은 무료예요',
    ],
  },
  landlord: {
    benefits: [
      '후보 세입자를 같은 기준으로 비교할 수 있어요',
      '감이 아닌 근거로 결정할 수 있어요',
      '필요한 만큼만 공개된 정보를 확인해요',
    ],
  },
  agent: {
    benefits: [
      '카드 진위 검증으로 중개 사고 위험을 낮춰요',
      '양쪽 말이 아닌 확인된 정보로 중개해요',
      '검증 이력이 기록으로 남아요',
    ],
  },
}

// ── MVP 화면 목업 (디자인 시안 '입주해 MVP 화면' 기준, 합성 예시 데이터) ──
// 제품 브랜드 팔레트: 크림 #FBF6EF / 숯 #262220 / 오렌지 #F0663F / 브론즈 #B08D62

function PhoneFrame({ dark = false, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border shadow-xl"
      style={{
        backgroundColor: dark ? '#262220' : '#FBF6EF',
        borderColor: dark ? '#3a342f' : '#e5ddd2',
      }}
    >
      <div
        className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold"
        style={{ color: dark ? '#FFF3DC99' : '#26222099' }}
      >
        <span>9:41</span>
        <span>●●● ▮</span>
      </div>
      <div className="px-4 pb-5 pt-3">{children}</div>
    </div>
  )
}

/** 임차인 · A4 발급 완료 화면 */
function TenantCardMockup() {
  return (
    <PhoneFrame>
      <p className="px-1 text-lg font-extrabold" style={{ color: '#262220' }}>
        카드가 나왔어요
      </p>
      <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: '#262220', color: '#FFF3DC' }}>
        <p className="text-[10px] font-bold tracking-wider" style={{ color: '#B08D62' }}>
          ⌂ 입주해 TRUST CARD
        </p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <span className="text-4xl font-extrabold leading-none">85</span>
            <p className="mt-1 text-[11px]" style={{ color: '#F0663F' }}>
              우수 · 상위 18%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">김*수</p>
            <p className="text-[10px] opacity-60">30대 · 1인 가구</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-[11px]">
          {[
            ['재직 형태', '정규직'],
            ['소득 구간', '4구간'],
            ['납부 연체', '없음'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="opacity-60">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px]">
          <span style={{ color: '#B08D62' }}>TC-2608-4471</span>
          <span style={{ color: '#8FBF9A' }}>✓ 검증됨</span>
        </div>
        <p className="mt-1 text-[9px] opacity-50">08.30 발급 · 09.29 만료</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          tabIndex={-1}
          className="flex-1 cursor-default rounded-xl py-2.5 text-xs font-bold text-white"
          style={{ backgroundColor: '#F0663F' }}
        >
          카드 공유
        </button>
        <span
          className="flex w-11 items-center justify-center rounded-xl border text-sm"
          style={{ borderColor: '#e5ddd2', color: '#262220' }}
          aria-hidden="true"
        >
          ▦
        </span>
      </div>
      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: '#e5ddd2' }}>
        <p className="text-[10px] font-bold" style={{ color: '#26222099' }}>
          열람 기록
        </p>
        <div className="mt-1.5 space-y-1.5 text-[11px]" style={{ color: '#262220' }}>
          <p>
            <span className="font-semibold">박 집주인 · 망원동 투룸</span>
            <span className="opacity-50"> — 오늘 14:02 열람</span>
          </p>
          <p>
            <span className="font-semibold">연남 공인중개사</span>
            <span className="opacity-50"> — 어제 11:20 열람</span>
          </p>
        </div>
      </div>
    </PhoneFrame>
  )
}

/** 임대인 · B1 카드 열람 화면 */
function LandlordViewMockup() {
  return (
    <PhoneFrame dark>
      <div className="flex items-center justify-between px-1" style={{ color: '#FFF3DC' }}>
        <span className="text-sm font-bold">‹ Trust Card</span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{ backgroundColor: '#3E5C46', color: '#BFE3C8' }}
        >
          검증됨
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between px-1" style={{ color: '#FFF3DC' }}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: '#B08D62', color: '#262220' }}
          >
            김
          </span>
          <div>
            <p className="text-sm font-bold">김*수</p>
            <p className="text-[10px] opacity-60">30대 · 1인 가구 · 정규직</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold leading-none" style={{ color: '#F0663F' }}>
            85
          </p>
          <p className="text-[10px] opacity-60">우수</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white/5 p-3">
        <p className="text-[10px] font-bold" style={{ color: '#B08D62' }}>
          공개된 항목
        </p>
        <div className="mt-1.5 space-y-1.5 text-[11px]" style={{ color: '#FFF3DC' }}>
          {[
            ['소득 구간', '4구간'],
            ['재직 형태', '정규직 3년+'],
            ['납부 연체', '없음'],
            ['가구 구성', '1인 · 반려동물 없음'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="opacity-70">✓ {k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
          {[
            ['이름 · 연락처', '관심 후 공개'],
            ['회사명', '비공개 설정'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between opacity-40">
              <span>🔒 {k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-white/5 p-3 text-[11px] italic" style={{ color: '#FFF3DC' }}>
        &ldquo;조용히 오래 살 집을 찾고 있어요. 3년 이상 계약 희망합니다.&rdquo;
      </p>
      <p className="mt-2 px-1 text-[9px]" style={{ color: '#FFF3DC66' }}>
        이 카드는 09.29에 만료됩니다. 열람 사실은 상대에게 기록으로 남았습니다.
      </p>
      <button
        type="button"
        tabIndex={-1}
        className="mt-3 w-full cursor-default rounded-xl py-2.5 text-xs font-bold"
        style={{ backgroundColor: '#E9A23B', color: '#262220' }}
      >
        관심 보내기
      </button>
    </PhoneFrame>
  )
}

/** 중개사 · B3 카드 진위 검증 (웹) */
function AgentVerifyMockup() {
  return (
    <div
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border shadow-xl"
      style={{ backgroundColor: '#FBF6EF', borderColor: '#e5ddd2' }}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: '#e5ddd2' }}>
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-red-300" />
          <span className="h-2 w-2 rounded-full bg-yellow-300" />
          <span className="h-2 w-2 rounded-full bg-green-300" />
        </span>
        <span className="text-[11px] font-bold" style={{ color: '#262220' }}>
          입주해 중개 · 카드 검증
        </span>
        <span className="ml-auto text-[9px]" style={{ color: '#26222066' }}>
          연남 공인중개사
        </span>
      </div>
      <div className="p-4">
        <p className="text-sm font-extrabold" style={{ color: '#262220' }}>
          카드 진위 검증
        </p>
        <div className="mt-2.5 flex gap-2">
          <span
            className="flex-1 rounded-lg border-2 px-3 py-2 font-mono text-xs font-bold"
            style={{ borderColor: '#4C7A5A', color: '#262220', backgroundColor: '#fff' }}
          >
            TC-2608-4471
          </span>
          <span
            className="flex items-center rounded-lg px-3.5 text-xs font-bold text-white"
            style={{ backgroundColor: '#4C7A5A' }}
          >
            검증
          </span>
        </div>
        <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: '#cfe0d2', backgroundColor: '#EFF5EE' }}>
          <p className="text-xs font-extrabold" style={{ color: '#3E5C46' }}>
            ✓ 유효한 카드입니다
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: '#3E5C4699' }}>
            2026.08.30 발급 · 09.29 만료
          </p>
          <div className="mt-2.5 flex gap-2">
            <div className="flex-1 rounded-lg bg-white p-2 text-center">
              <p className="text-[9px]" style={{ color: '#26222066' }}>
                종합 점수
              </p>
              <p className="text-lg font-extrabold" style={{ color: '#262220' }}>
                85
              </p>
            </div>
            <div className="flex-1 rounded-lg bg-white p-2 text-center">
              <p className="text-[9px]" style={{ color: '#26222066' }}>
                등급
              </p>
              <p className="text-lg font-extrabold" style={{ color: '#4C7A5A' }}>
                우수
              </p>
            </div>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px]" style={{ color: '#262220' }}>
            {[
              ['본인 인증', '통신사'],
              ['재직 · 소득', '정규직 · 4구간'],
              ['납부 이력 6개월', '연체 없음'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="opacity-70">✓ {k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <div className="flex justify-between opacity-40">
              <span>이름 · 연락처</span>
              <span>비공개</span>
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[9px] leading-relaxed" style={{ color: '#26222066' }}>
          중개사 열람은 고객에게 기록으로 통지됩니다. 카드 내용을 외부에 옮기거나 저장하는 것은 약관 위반입니다.
        </p>
      </div>
    </div>
  )
}

const ROLE_MOCKUP: Record<Role, () => React.JSX.Element> = {
  tenant: TenantCardMockup,
  landlord: LandlordViewMockup,
  agent: AgentVerifyMockup,
}

const PROBLEMS: { role: string; quote: string; icon: React.ReactNode }[] = [
  {
    role: '임차인',
    quote: '내가 성실한 세입자라는 걸 증명할 방법이 없다',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    role: '임대인',
    quote: '이 사람이 월세를 제때 낼 사람인지 알 수 없다',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8" aria-hidden="true">
        <path d="M4 21V10l8-6 8 6v11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 21v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    role: '공인중개사',
    quote: '양쪽 말만 믿고 중개하기 불안하다',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8" aria-hidden="true">
        <path d="M8 12h8M8 8h8M8 16h5" strokeLinecap="round" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    ),
  },
]

const FLOW_STEPS = [
  { step: '1', who: '임차인', what: 'Trust Card를 발급해요', detail: '자기 신뢰 정보를 담은 카드를 무료로 만들어요' },
  { step: '2', who: '임대인', what: '카드를 열람하고 비교해요', detail: '같은 기준으로 후보를 확인하고 결정해요' },
  { step: '3', who: '공인중개사', what: '카드 진위를 검증해요', detail: '확인된 정보인지 검증해 안심 계약을 도와요' },
]

const DATASCORE = [
  {
    label: '소득 안정성',
    value: 30,
    color: '#E9A23B',
    desc: '재직 형태와 기간, 월세 대비 소득 비율. 절대 금액이 아니라 비율만 봐요',
  },
  {
    label: '납부 이력',
    value: 30,
    color: '#F0BC6E',
    desc: '최근 24개월 통신·공과금 연체 여부. 금융 신용등급은 쓰지 않아요',
  },
  {
    label: '거주 평판',
    value: 25,
    color: '#5B79B0',
    desc: '이전 계약 완주와 정시 납부. 이력이 없어도 불이익 없이 환산해요',
  },
  {
    label: '본인 인증',
    value: 15,
    color: '#8FA6CC',
    desc: '통신사 또는 공동인증, 얼굴 확인. 한 번 하면 갱신 전까지 유지돼요',
  },
]

const NOT_COLLECTED = ['나이', '성별', '국적', '학력', '직장 이름', '가족 관계', '금융 신용등급']

const FAQS = [
  {
    q: '무료인가요?',
    a: '네. 사전 신청과 Trust Card 발급은 무료입니다. 유료 기능이 생기더라도 사전 신청자에게는 출시 후 첫 3개월 무료 이용권을 드려요.',
  },
  {
    q: '개인정보는 안전한가요?',
    a: '필요한 만큼만, 필요한 때만 공개되는 것이 원칙입니다. 사전 신청 단계에서는 휴대폰 번호와 역할, 선택 입력한 이름·이메일만 수집하며 초대와 혜택 안내 외 목적으로 쓰지 않아요.',
  },
  {
    q: '언제 출시되나요?',
    a: '지금 베타 준비 중입니다. 사전 신청자에게 준비되는 대로 순서대로 초대 메일을 보내드려요.',
  },
  {
    q: '신용등급을 조회하는 건가요?',
    a: '아니요. 입주해는 금융 신용등급을 조회하지도, 수집하지도 않습니다. 소득 안정성, 납부 이력, 거주 평판, 본인 인증 등 임대차에 필요한 신뢰 정보만 다뤄요.',
  },
  {
    q: '중개사무소도 쓸 수 있나요?',
    a: '네. 공인중개사는 임차인이 제시한 카드의 진위를 검증하는 용도로 사용할 수 있습니다. 사전 신청 시 역할에서 공인중개사를 선택해주세요.',
  },
]

/** 스크롤 진입 시 페이드인 래퍼 */
function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 이미 뷰포트 안이거나 IntersectionObserver를 못 쓰는 환경이면 즉시 표시
    if (
      typeof IntersectionObserver === 'undefined' ||
      el.getBoundingClientRect().top < window.innerHeight
    ) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
    >
      {children}
    </div>
  )
}

function SignupForm({ onSuccess }: { onSuccess: (count: number) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^01[016789][0-9]{7,8}$/.test(phone.replace(/[^0-9]/g, ''))) {
      setError('올바른 휴대폰 번호를 입력해주세요')
      return
    }
    if (!role) {
      setError('역할을 선택해주세요')
      return
    }
    if (!consent) {
      setError('개인정보 수집·이용에 동의해주세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          email: email || undefined,
          user_type: role,
          name: name || undefined,
          consent,
        }),
      })
      const data = (await res.json()) as { message?: string; error?: string; count?: number }
      if (!res.ok) {
        setError(data.error ?? '신청 중 오류가 발생했어요. 잠시 후 다시 시도해주세요')
        return
      }
      onSuccess(data.count ?? 0)
    } catch {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="사전 신청 폼">
      <div>
        <label htmlFor="wl-name" className="mb-1.5 block text-sm font-medium text-white/90">
          이름 <span className="font-normal text-white/50">(선택)</span>
        </label>
        <input
          id="wl-name"
          type="text"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-[#E9A23B] focus:ring-1 focus:ring-[#E9A23B]"
        />
      </div>
      <div>
        <label htmlFor="wl-phone" className="mb-1.5 block text-sm font-medium text-white/90">
          휴대폰 번호 <span className="text-[#E9A23B]">*</span>
        </label>
        <input
          id="wl-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          autoComplete="tel"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-[#E9A23B] focus:ring-1 focus:ring-[#E9A23B]"
        />
        <p className="mt-1 text-xs text-white/50">초대와 혜택 안내를 문자로 보내드려요</p>
      </div>
      <div>
        <label htmlFor="wl-email" className="mb-1.5 block text-sm font-medium text-white/90">
          이메일 <span className="font-normal text-white/50">(선택)</span>
        </label>
        <input
          id="wl-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-[#E9A23B] focus:ring-1 focus:ring-[#E9A23B]"
        />
        <p className="mt-1 text-xs text-white/50">남겨주시면 베타 초대 메일도 함께 보내드려요</p>
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-white/90">
          어떤 입장이신가요? <span className="text-[#E9A23B]">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                role === r
                  ? 'border-[#E9A23B] bg-[#E9A23B] text-[#0C2247]'
                  : 'border-white/20 bg-white/10 text-white/80 hover:border-white/40'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2.5 text-sm text-white/80">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#E9A23B]"
          required
        />
        <span>
          개인정보 수집·이용에 동의합니다 <span className="text-[#E9A23B]">*</span>
          <span className="mt-0.5 block text-xs text-white/50">
            수집 항목: 휴대폰 번호, 역할, 이름·이메일(선택) · 목적: 사전 신청 접수와 초대·혜택 안내(문자/이메일) ·
            서비스 정식 오픈 후 6개월 또는 동의 철회 시까지 보관 후 파기
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-500/15 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#E9A23B] px-6 py-4 text-base font-bold text-[#0C2247] transition hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? '신청 중…' : '사전 신청하고 얼리 혜택 받기'}
      </button>
    </form>
  )
}

export function WaitlistLanding({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [submitted, setSubmitted] = useState(false)
  const [showSticky, setShowSticky] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('tenant')
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.7
      const formEl = formRef.current
      const formInView = formEl
        ? formEl.getBoundingClientRect().top < window.innerHeight && formEl.getBoundingClientRect().bottom > 0
        : false
      setShowSticky(pastHero && !formInView)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleSuccess = (newCount: number) => {
    setSubmitted(true)
    if (newCount > 0) setCount(newCount)
  }

  return (
    <div className="min-h-screen bg-white text-[#1a2333]" style={{ fontFamily: "'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif" }}>
      {/* ── 히어로 ─────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] flex-col text-white" style={{ backgroundColor: NAVY }}>
        <header className="flex items-center justify-between px-6 py-6 sm:px-10">
          <span className="text-xl font-extrabold tracking-tight">입주해</span>
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-white/25 px-3.5 py-1.5 text-xs font-medium text-white/80">
              출시 준비 중
            </span>
            <a
              href="/preview"
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/20"
            >
              서비스 미리보기 →
            </a>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 sm:px-10">
          <h1 className="text-4xl font-extrabold leading-[1.25] tracking-tight sm:text-5xl lg:text-6xl">
            {HEADLINE[0]}
            <br />
            {HEADLINE[1]}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
            임차인은 증명하고, 임대인은 확인하고, 중개사는 검증합니다. 입주해.
          </p>
          <div className="mt-10">
            <button
              onClick={scrollToForm}
              className="rounded-lg px-7 py-4 text-base font-bold text-[#0C2247] shadow-lg transition hover:brightness-105"
              style={{ backgroundColor: AMBER }}
            >
              사전 신청하고 얼리 혜택 받기
            </button>
            {count >= COUNT_DISPLAY_THRESHOLD ? (
              <p className="mt-4 text-sm text-white/60">
                현재 <strong className="font-bold text-white">{count.toLocaleString()}</strong>명이 신청했습니다
              </p>
            ) : (
              <p className="mt-4 text-sm text-white/60">지금 신청하면 가장 먼저 초대받아요</p>
            )}
          </div>
        </div>
      </section>

      {/* ── 문제 공감 ──────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
        <FadeIn>
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            서로를 못 믿어서 생기는 <span style={{ color: AMBER }}>계약 불안</span>
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {PROBLEMS.map((p) => (
              <div key={p.role} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                <div className="text-slate-400">{p.icon}</div>
                <p className="mt-5 text-sm font-semibold text-slate-500">{p.role}</p>
                <p className="mt-1.5 font-medium leading-relaxed">&ldquo;{p.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── 해결 흐름 ──────────────────────────────── */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <FadeIn>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              입주해는 이렇게 <span style={{ color: AMBER }}>신뢰의 순환</span>을 만듭니다
            </h2>
            <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {FLOW_STEPS.map((s, i) => (
                <div key={s.step} className="flex flex-1 flex-col items-center gap-3 sm:flex-row">
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div
                      className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: NAVY }}
                    >
                      {s.step}
                    </div>
                    <p className="mt-3 text-sm font-semibold" style={{ color: AMBER }}>
                      {s.who}
                    </p>
                    <p className="mt-1 font-bold">{s.what}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.detail}</p>
                  </div>
                  {i < FLOW_STEPS.length - 1 ? (
                    <div className="rotate-90 text-2xl text-slate-300 sm:rotate-0" aria-hidden="true">
                      →
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 역할별 상세 (탭) ───────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
        <FadeIn>
          <h2 className="text-center text-2xl font-bold sm:text-3xl">역할별로 이렇게 쓰세요</h2>
          <div role="tablist" aria-label="역할 선택" className="mx-auto mt-10 flex w-full max-w-md rounded-xl bg-slate-100 p-1.5">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={activeRole === r}
                onClick={() => setActiveRole(r)}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  activeRole === r ? 'bg-white text-[#0C2247] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="mt-8 grid items-center gap-8 sm:grid-cols-2">
            <div>
              {(() => {
                const Mockup = ROLE_MOCKUP[activeRole]
                return <Mockup />
              })()}
              <p className="mt-3 text-center text-xs text-slate-400">개발 중인 화면 · 합성 예시 데이터</p>
            </div>
            <ul className="space-y-4">
              {ROLE_DETAILS[activeRole].benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: AMBER }}
                  >
                    ✓
                  </span>
                  <span className="font-medium leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </section>

      {/* ── DataScore ─────────────────────────────── */}
      <section className="py-20 text-white sm:py-28" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <FadeIn>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              100점의 <span style={{ color: AMBER }}>DataScore</span>, 딱 네 가지만 봅니다
            </h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-2">
              <div>
                <div className="flex h-14 w-full overflow-hidden rounded-xl" role="img" aria-label="DataScore 구성 비율">
                  {DATASCORE.map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center justify-center text-xs font-bold text-[#0C2247]"
                      style={{ width: `${d.value}%`, backgroundColor: d.color }}
                    >
                      {d.value}
                    </div>
                  ))}
                </div>
                <ul className="mt-5 space-y-3.5">
                  {DATASCORE.map((d) => (
                    <li key={d.label}>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} aria-hidden="true" />
                        <span className="font-medium">{d.label}</span>
                        <span className="ml-auto font-bold" style={{ color: AMBER }}>
                          {d.value}점
                        </span>
                      </div>
                      <p className="mt-0.5 pl-6 text-xs leading-relaxed text-white/50">{d.desc}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-white/40">구성 항목과 비율은 정식 출시 시점에 일부 조정될 수 있습니다.</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-7">
                <h3 className="text-lg font-bold">
                  보지 <span style={{ color: AMBER }}>않는</span> 것
                </h3>
                <p className="mt-1.5 text-sm text-white/60">아래 정보는 수집조차 하지 않습니다.</p>
                <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                  {NOT_COLLECTED.map((n) => (
                    <li key={n} className="flex items-center gap-2.5 text-sm font-medium text-white/85">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/60" aria-hidden="true">
                        ✕
                      </span>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 개인정보 안심 ──────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-10 sm:py-24">
        <FadeIn>
          <h2 className="text-2xl font-bold sm:text-3xl">필요한 만큼만, 필요한 때만</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-600">
            Trust Card의 정보는 카드 주인이 허락한 범위에서, 계약 검토에 필요한 때만 공개됩니다. 전체 공개가 아니라
            선택 공개가 기본값입니다.
          </p>
          <span
            className="mt-6 inline-block rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: AMBER, color: '#B87A18' }}
          >
            특허 출원 중
          </span>
        </FadeIn>
      </section>

      {/* ── 곧 추가될 기능 ─────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pb-20 sm:px-10 sm:pb-24">
        <FadeIn>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-7 text-center opacity-75">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">준비 중</p>
            <p className="mt-2 font-semibold text-slate-500">등기부등본·건축물대장 자동 확인 리포트</p>
            <p className="mt-1 text-sm text-slate-400">집에 대한 공적 서류도 자동으로 확인해드릴 수 있게 준비하고 있어요.</p>
          </div>
        </FadeIn>
      </section>

      {/* ── 신청 폼 ────────────────────────────────── */}
      <section ref={formRef} className="scroll-mt-8 py-20 text-white sm:py-28" style={{ backgroundColor: NAVY }} id="waitlist-form">
        <div className="mx-auto max-w-xl px-6 sm:px-10">
          <FadeIn>
            {submitted ? (
              <div className="text-center">
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl text-[#0C2247]"
                  style={{ backgroundColor: AMBER }}
                >
                  ✓
                </div>
                <h2 className="mt-6 text-2xl font-bold sm:text-3xl">신청이 완료됐어요</h2>
                <p className="mt-3 leading-relaxed text-white/70">
                  준비되는 대로 초대 메일을 보내드릴게요.
                  {count >= COUNT_DISPLAY_THRESHOLD ? (
                    <>
                      <br />
                      지금까지 <strong className="text-white">{count.toLocaleString()}</strong>명이 함께하고 있어요.
                    </>
                  ) : null}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-center text-2xl font-bold sm:text-3xl">사전 신청하고 혜택 받기</h2>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-5">
                    <p className="text-2xl" aria-hidden="true">
                      ☕
                    </p>
                    <p className="mt-2 text-sm font-bold">매주 추첨 커피 기프티콘</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">사전 신청자 중 매주 추첨으로 드려요</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 p-5">
                    <p className="text-2xl" aria-hidden="true">
                      🎁
                    </p>
                    <p className="mt-2 text-sm font-bold">첫 3개월 무료 이용권</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">출시 후 유료 기능을 무료로 먼저 써보세요</p>
                  </div>
                </div>
                <div className="mt-8">
                  <SignupForm onSuccess={handleSuccess} />
                </div>
              </>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
        <FadeIn>
          <h2 className="text-center text-2xl font-bold sm:text-3xl">자주 묻는 질문</h2>
          <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
            {FAQS.map((f, i) => (
              <div key={f.q}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold"
                >
                  {f.q}
                  <span
                    className={`text-slate-400 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
                {openFaq === i ? <p className="pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p> : null}
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── 기능 요구사항 소통창구 ─────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pb-20 sm:px-10 sm:pb-28">
        <FadeIn>
          <FeatureRequestForm source="landing" />
        </FadeIn>
      </section>

      {/* ── 푸터 ───────────────────────────────────── */}
      <footer className="px-6 py-12 text-white sm:px-10" style={{ backgroundColor: '#081833' }}>
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-extrabold">입주해</p>
            <p className="mt-1 text-sm text-white/50">임대차 거래의 신뢰를 만듭니다</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-white/60 sm:items-end">
            <a href="mailto:ipjuhae.official@gmail.com" className="hover:text-white">
              ipjuhae.official@gmail.com
            </a>
            <a href="/privacy" className="underline underline-offset-2 hover:text-white">
              개인정보처리방침
            </a>
            <a href="/preview" className="hover:text-white">
              서비스 미리보기
            </a>
          </div>
        </div>
      </footer>

      {/* ── 하단 고정 CTA ──────────────────────────── */}
      {showSticky && !submitted ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]" style={{ backgroundColor: NAVY }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="hidden text-sm font-medium text-white/80 sm:block">계약 전에 서로를 확인하는 가장 쉬운 방법</p>
            <button
              onClick={scrollToForm}
              className="w-full rounded-lg px-6 py-3 text-sm font-bold text-[#0C2247] transition hover:brightness-105 sm:w-auto"
              style={{ backgroundColor: AMBER }}
            >
              사전 신청하고 얼리 혜택 받기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
