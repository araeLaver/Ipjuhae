'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { LogoSymbol } from '@/components/brand/logo-symbol'
import { FeatureRequestForm } from '@/components/feedback/feature-request-form'

// 로그인 이후 화면을 회원가입 없이 구경할 수 있는 미리보기.
// 모든 데이터는 합성 예시이며 실제 API를 호출하지 않는다.

const MENUS = [
  { key: 'profile', label: '프로필' },
  { key: 'verification', label: '인증' },
  { key: 'access-logs', label: '열람 기록' },
  { key: 'messages', label: '메시지' },
  { key: 'trust-center', label: '신뢰센터' },
  { key: 'transactions', label: '거래' },
  { key: 'community', label: '커뮤니티' },
] as const

type MenuKey = (typeof MENUS)[number]['key']

const SCORE_ITEMS = [
  { name: '소득 안정성', got: 26, max: 30, note: '정규직 · 월세 대비 소득 비율 양호' },
  { name: '납부 이력', got: 30, max: 30, note: '24개월 연체 없음' },
  { name: '거주 평판', got: 17, max: 25, note: '이전 집주인 확인 시 +5점' },
  { name: '본인 인증', got: 12, max: 15, note: '통신사 인증 완료' },
]

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-background p-4 ${className}`}>{children}</div>
}

function ProfilePane() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#262220', color: '#FFF3DC' }}>
        <p className="text-[11px] font-bold tracking-wider" style={{ color: '#B08D62' }}>
          ⌂ 입주해 TRUST CARD
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className="text-5xl font-extrabold leading-none">85</span>
            <p className="mt-1 text-xs" style={{ color: '#F0663F' }}>
              우수 · 상위 18%
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold">김*수</p>
            <p className="text-xs opacity-60">30대 · 1인 가구</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
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
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
          <span style={{ color: '#B08D62' }}>TC-2608-4471</span>
          <span style={{ color: '#8FBF9A' }}>✓ 검증됨</span>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">DataScore · 100점 만점 4항목</p>
        {SCORE_ITEMS.map((s) => (
          <SectionCard key={s.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{s.name}</span>
              <span className="font-bold">
                {s.got}
                <span className="text-muted-foreground"> / {s.max}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.got / s.max) * 100}%`, backgroundColor: '#F0663F' }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.note}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}

function VerificationPane() {
  return (
    <div className="space-y-3">
      {[
        { name: '본인 인증', state: '완료 · 통신사 인증', done: true },
        { name: '재직 · 소득', state: '완료 · 건강보험 자격득실', done: true },
        { name: '납부 이력', state: '완료 · 통신·공과금 6개월', done: true },
        { name: '거주 평판', state: '선택 · 이전 집주인 확인 대기', done: false },
      ].map((v) => (
        <SectionCard key={v.name} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {v.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#4C7A5A' }} aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-semibold">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.state}</p>
            </div>
          </div>
          {!v.done && (
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: '#F0663F' }}>
              +5점
            </span>
          )}
        </SectionCard>
      ))}
      <p className="text-xs text-muted-foreground">
        연결한 자료는 점수로만 바뀌어 저장되고 원본은 30일 후 삭제됩니다.
      </p>
    </div>
  )
}

function AccessLogsPane() {
  return (
    <div className="space-y-3">
      {[
        { who: '박 집주인 · 망원동 투룸', when: '오늘 14:02', what: '카드 열람' },
        { who: '연남 공인중개사', when: '어제 11:20', what: '카드 진위 검증' },
        { who: '최 집주인 · 합정 오피스텔', when: '08.28 09:41', what: '카드 열람' },
      ].map((l) => (
        <SectionCard key={l.who + l.when} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{l.who}</p>
              <p className="text-xs text-muted-foreground">{l.what}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{l.when}</span>
        </SectionCard>
      ))}
      <p className="text-xs text-muted-foreground">누가 언제 내 카드를 봤는지 전부 기록으로 남습니다.</p>
    </div>
  )
}

function MessagesPane() {
  return (
    <div className="space-y-3">
      <SectionCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">박 집주인 · 망원동 투룸</p>
          <span className="text-xs text-muted-foreground">오늘 14:10</span>
        </div>
        <div className="mt-3 space-y-2">
          <p className="w-fit max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm">
            카드 잘 봤습니다. 이번 주말에 집 보러 오실 수 있나요?
          </p>
          <p
            className="ml-auto w-fit max-w-[85%] rounded-xl px-3 py-2 text-sm text-white"
            style={{ backgroundColor: '#F0663F' }}
          >
            네, 토요일 오후 2시 가능합니다!
          </p>
        </div>
      </SectionCard>
      <SectionCard className="flex items-center justify-between opacity-70">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">연남 공인중개사</p>
            <p className="text-xs text-muted-foreground">진위 확인됐습니다. 계약 일정 조율드릴게요.</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">어제</span>
      </SectionCard>
    </div>
  )
}

function TrustCenterPane() {
  return (
    <div className="space-y-3">
      {[
        {
          icon: ShieldCheck,
          title: '원본 서류는 상대에게 가지 않아요',
          desc: '연결한 자료는 점수로만 바뀌고, 원본은 30일 후 삭제됩니다.',
        },
        {
          icon: Lock,
          title: '보여줄 항목은 매번 고를 수 있어요',
          desc: '끈 항목은 점수에는 반영되지만 상대 화면에는 나타나지 않습니다.',
        },
        {
          icon: Bell,
          title: '열람은 전부 통지돼요',
          desc: '누가 언제 카드를 봤는지 기록이 남고 알림이 옵니다.',
        },
        {
          icon: FileText,
          title: '산정 기준은 공개돼 있어요',
          desc: '소득 30 · 납부 30 · 평판 25 · 인증 15. 나이·성별·학력·신용등급은 수집하지 않습니다.',
        },
      ].map((t) => (
        <SectionCard key={t.title} className="flex items-start gap-3">
          <t.icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#F0663F' }} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{t.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
          </div>
        </SectionCard>
      ))}
    </div>
  )
}

function TransactionsPane() {
  const steps = ['카드 공유', '열람 · 관심', '집 보기', '계약 체결', '입주']
  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">망원동 투룸 · 박 집주인</p>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: '#EFF5EE', color: '#3E5C46' }}
          >
            진행 중
          </span>
        </div>
        <ol className="mt-4 flex items-center gap-1">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                style={
                  i <= 2
                    ? { backgroundColor: '#F0663F', color: '#fff' }
                    : { backgroundColor: 'var(--muted, #eee)', color: 'inherit' }
                }
              >
                {i + 1}
              </span>
              <span className={`text-[10px] ${i <= 2 ? 'font-semibold' : 'text-muted-foreground'}`}>{s}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
      <p className="text-xs text-muted-foreground">거래 단계가 한눈에 보이고, 단계마다 필요한 확인이 기록됩니다.</p>
    </div>
  )
}

function CommunityPane() {
  return (
    <div className="space-y-3">
      {[
        { title: '전세보증보험, 가입 전 꼭 확인할 것 3가지', meta: '정보 공유 · 댓글 12', badge: '인기' },
        { title: '첫 자취 계약 후기 — Trust Card 덕에 서류 왕복이 없었어요', meta: '후기 · 댓글 8', badge: null },
        { title: '망원동 근처 조용한 동네 추천 부탁드려요', meta: '질문 · 댓글 5', badge: null },
      ].map((p) => (
        <SectionCard key={p.title} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold leading-snug">{p.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.meta}</p>
          </div>
          {p.badge && (
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: '#F0663F' }}>
              {p.badge}
            </span>
          )}
        </SectionCard>
      ))}
    </div>
  )
}

const PANES: Record<MenuKey, { title: string; desc: string; render: () => React.JSX.Element }> = {
  profile: {
    title: '프로필 · Trust Card',
    desc: '내 카드와 DataScore를 한눈에 봅니다.',
    render: ProfilePane,
  },
  verification: {
    title: '인증',
    desc: '데이터 연결 상태와 올릴 수 있는 점수를 확인합니다.',
    render: VerificationPane,
  },
  'access-logs': {
    title: '열람 기록',
    desc: '누가 언제 내 카드를 봤는지 확인합니다.',
    render: AccessLogsPane,
  },
  messages: {
    title: '메시지',
    desc: '카드를 본 임대인·중개사와 바로 대화합니다.',
    render: MessagesPane,
  },
  'trust-center': {
    title: '신뢰센터',
    desc: '입주해가 정보를 다루는 원칙입니다.',
    render: TrustCenterPane,
  },
  transactions: {
    title: '거래',
    desc: '카드 공유부터 입주까지 진행 단계를 봅니다.',
    render: TransactionsPane,
  },
  community: {
    title: '커뮤니티',
    desc: '세입자·집주인이 정보와 후기를 나눕니다.',
    render: CommunityPane,
  },
}

export function ServicePreview() {
  const [active, setActive] = useState<MenuKey>('profile')
  const pane = PANES[active]

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background">
      {/* 미리보기 안내 배너 */}
      <div className="text-white" style={{ backgroundColor: '#0C2247' }}>
        <div className="container mx-auto flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm">
            <span className="font-bold" style={{ color: '#E9A23B' }}>
              미리보기 모드
            </span>
            <span className="text-white/80">
              {' '}
              — 로그인 후 화면을 합성 예시 데이터로 구경하는 중입니다. 가입 없이 자유롭게 둘러보세요.
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/#waitlist-form"
              className="rounded-lg px-4 py-1.5 text-xs font-bold text-[#0C2247]"
              style={{ backgroundColor: '#E9A23B' }}
            >
              사전 신청하고 초대받기
            </Link>
          </div>
        </div>
      </div>

      {/* 로그인 후와 같은 구조의 헤더 (메뉴 = 미리보기 전환 탭) */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <LogoSymbol className="h-7 w-7" />
              <span className="text-xl font-bold">입주해</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto" aria-label="미리보기 메뉴">
              {MENUS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActive(m.key)}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm transition-colors ${
                    active === m.key
                      ? 'bg-muted font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: '#B08D62', color: '#262220' }}>
              김
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{pane.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pane.desc}</p>
          </div>
          <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            합성 예시 데이터
          </span>
        </div>

        {pane.render()}

        <div className="mt-10">
          <FeatureRequestForm source="preview" />
        </div>

        <div className="mt-6 rounded-2xl p-6 text-center text-white" style={{ backgroundColor: '#0C2247' }}>
          <p className="text-lg font-bold">마음에 드셨나요?</p>
          <p className="mt-1 text-sm text-white/70">사전 신청하면 오픈 시 가장 먼저 초대해드립니다.</p>
          <Link
            href="/#waitlist-form"
            className="mt-4 inline-block rounded-lg px-6 py-2.5 text-sm font-bold text-[#0C2247]"
            style={{ backgroundColor: '#E9A23B' }}
          >
            사전 신청하기
          </Link>
        </div>
      </main>
    </div>
  )
}
