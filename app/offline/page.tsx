import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '오프라인',
  robots: { index: false },
}

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="text-5xl" role="img" aria-label="연결 끊김">
        📡
      </span>
      <h1 className="text-2xl font-bold text-foreground">인터넷 연결이 끊겼어요</h1>
      <p className="text-muted-foreground">
        네트워크 연결을 확인한 뒤 다시 시도해 주세요.
      </p>
    </div>
  )
}
