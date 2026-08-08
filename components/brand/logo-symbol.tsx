/**
 * 입주해 브랜드 심볼 — "지붕 아래 두 사람"
 * 좌: 세입자(감빛 #f0663f) · 우: 집주인(앰버 #e8a33d)
 * 지붕은 두 사람을 함께 감싸는 신뢰의 지붕선.
 */
export function LogoSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="입주해"
    >
      {/* 지붕 */}
      <path
        d="M7 22 L24 8 L41 22"
        stroke="#f0663f"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 세입자 (좌 · 감빛) */}
      <circle cx="18" cy="26.5" r="3.5" fill="#f0663f" />
      <path
        d="M13 40 C13 36.3 15.2 33.4 18 33.4 C20.8 33.4 23 36.3 23 40"
        stroke="#f0663f"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 집주인 (우 · 앰버) */}
      <circle cx="30" cy="26.5" r="3.5" fill="#e8a33d" />
      <path
        d="M25 40 C25 36.3 27.2 33.4 30 33.4 C32.8 33.4 35 36.3 35 40"
        stroke="#e8a33d"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
