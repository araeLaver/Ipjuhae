'use client'

/**
 * 설치 안내.
 *
 * 기기를 보고 필요한 것만 보여준다. 아이폰 쓰는 사람에게 안드로이드 설치법을
 * 보여주면 따라 하다가 막히고 만다. 반대도 마찬가지다.
 *
 * 설치 파일(APK)을 직접 내려주는 길도 만들어 봤다가 접었다. 85MB인 데다
 * 안드로이드가 "출처를 알 수 없는 앱" 경고를 띄우고, 대부분 거기서 그만둔다.
 * 지금은 플레이스토어의 테스트 참여 경로가 유일하게 깔끔한 길이다.
 */

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app'

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
        <p className="text-xs text-muted-foreground">
          플레이스토어에서 받습니다. 지금은 테스트 참여로 열립니다
        </p>
      </div>

      <a
        href={TESTING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        테스터로 참여하고 설치하기
      </a>

      <ol className="space-y-2.5">
        <Step n={1}>위 버튼을 누르면 구글 페이지가 열립니다</Step>
        <Step n={2}>
          <strong className="font-semibold">테스터 되기</strong> 를 누릅니다. 폰에 로그인된 구글
          계정으로 참여됩니다
        </Step>
        <Step n={3}>
          같은 화면의 <strong className="font-semibold">Google Play에서 다운로드</strong> 로
          설치합니다
        </Step>
      </ol>

      <p className="text-xs leading-relaxed text-muted-foreground">
        정식 출시 전이라 이 경로로만 설치됩니다. 구글은 새 개인 개발자 계정에 대해 테스터
        12명이 14일 동안 참여할 것을 요구하는데, 그 조건을 채우는 중입니다. 설치해 두시는 것만으로
        도움이 됩니다.
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
          폰 브라우저에서 <strong className="font-semibold">www.ipjuhae.com/install</strong> 을
          엽니다
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
