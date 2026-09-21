'use client'

/**
 * 설치 안내.
 *
 * 기기를 보고 필요한 것만 보여준다. 아이폰 쓰는 사람에게 APK를 보여주면
 * 받았다가 안 열려서 화만 난다. 반대도 마찬가지다.
 *
 * 안드로이드에 "출처를 알 수 없는 앱" 경고가 뜨는 걸 숨기지 않는다.
 * 미리 말해 두지 않으면 그 화면에서 그만둔다.
 */

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

const APK_URL = '/download/ipjuhae.apk'

function detect(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // 아이패드는 데스크톱 UA로 위장한다. 터치 지원 여부로 걸러낸다.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  return 'desktop'
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed">
      <span className="shrink-0 font-bold text-primary">{n}</span>
      <span>{children}</span>
    </li>
  )
}

function AndroidGuide() {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold">안드로이드</h2>
        <p className="text-xs text-muted-foreground">설치 파일을 받아서 바로 설치합니다</p>
      </div>

      <a
        href={APK_URL}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        설치 파일 받기
      </a>

      <ol className="space-y-2.5">
        <Step n={1}>위 버튼을 눌러 파일을 받습니다</Step>
        <Step n={2}>
          받은 파일을 열면 <strong className="font-semibold">출처를 알 수 없는 앱</strong> 이라는
          안내가 나옵니다. 플레이스토어를 거치지 않아서 뜨는 것이고, 한 번만 허용해 주시면 됩니다
        </Step>
        <Step n={3}>설치를 누릅니다</Step>
      </ol>

      <p className="text-xs leading-relaxed text-muted-foreground">
        이 파일은 www.ipjuhae.com 에서 직접 내려받습니다. 다른 곳에서 받은 파일은 설치하지
        마세요.
      </p>
    </Card>
  )
}

function IosGuide() {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold">아이폰</h2>
        <p className="text-xs text-muted-foreground">홈 화면에 추가하면 앱처럼 열립니다</p>
      </div>

      <ol className="space-y-2.5">
        <Step n={1}>
          사파리로 <strong className="font-semibold">www.ipjuhae.com/check</strong> 를 엽니다
        </Step>
        <Step n={2}>아래쪽 가운데 공유 버튼을 누릅니다</Step>
        <Step n={3}>
          목록을 내려서 <strong className="font-semibold">홈 화면에 추가</strong> 를 누릅니다
        </Step>
        <Step n={4}>홈 화면에 생긴 아이콘으로 여시면 됩니다</Step>
      </ol>

      <p className="text-xs leading-relaxed text-muted-foreground">
        크롬이 아니라 사파리로 여셔야 홈 화면에 추가가 나옵니다. 아이폰용 정식 앱은 준비 중입니다.
      </p>
    </Card>
  )
}

function DesktopGuide() {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold">지금 보시는 기기</h2>
        <p className="text-xs text-muted-foreground">
          폰으로 열어주시면 설치 방법을 바로 안내해 드립니다
        </p>
      </div>

      <ol className="space-y-2.5">
        <Step n={1}>
          폰 브라우저에서 <strong className="font-semibold">www.ipjuhae.com/app</strong> 을 엽니다
        </Step>
        <Step n={2}>기기에 맞는 설치 방법이 나옵니다</Step>
      </ol>

      <p className="text-xs leading-relaxed text-muted-foreground">
        컴퓨터에서는 설치 없이{' '}
        <a href="/check" className="text-primary underline underline-offset-4">
          웹에서 바로
        </a>{' '}
        쓰실 수 있습니다.
      </p>
    </Card>
  )
}

export function InstallGuide() {
  // 서버에서는 기기를 모른다. 처음 그림에서는 아무 안내도 확정하지 않는다.
  const [platform, setPlatform] = useState<Platform>('unknown')

  useEffect(() => {
    setPlatform(detect())
  }, [])

  if (platform === 'unknown') {
    return (
      <Card className="p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">기기를 확인하는 중입니다</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {platform === 'android' ? <AndroidGuide /> : null}
      {platform === 'ios' ? <IosGuide /> : null}
      {platform === 'desktop' ? <DesktopGuide /> : null}
    </div>
  )
}
