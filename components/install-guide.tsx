'use client'

/**
 * 설치 안내.
 *
 * 기기를 보고 필요한 것만 보여준다. 아이폰 쓰는 사람에게 안드로이드 설치법을
 * 보여주면 따라 하다가 막히고 만다. 반대도 마찬가지다.
 *
 * 설치 파일(APK)을 직접 내려주는 길도 만들어 봤다가 접었다. 85MB인 데다
 * 안드로이드가 "출처를 알 수 없는 앱" 경고를 띄우고, 대부분 거기서 그만둔다.
 * 웹에서 바로 사용하고 홈 화면에 추가한다. 플레이스토어 테스트는 선택 사항이다.
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
  return <Card className="space-y-4 p-5 sm:p-6">
    <h2 className="text-base font-bold">안드로이드</h2>
    <p className="text-sm text-muted-foreground">테스트 참여 없이 웹에서 바로 쓰고 홈 화면에 추가할 수 있습니다.</p>
    <a href="/check?from=install" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">웹에서 바로 사용하기</a>
    <ol className="space-y-2.5">
      <Step n={1}>Chrome에서 www.ipjuhae.com/check를 엽니다.</Step>
      <Step n={2}>브라우저 메뉴에서 홈 화면에 추가를 누르고, 앱 설치 또는 바로가기 만들기를 선택합니다.</Step>
      <Step n={3}>홈 화면의 입주해 아이콘으로 다시 열어 후보와 질문을 확인하세요.</Step>
    </ol>
    <p className="text-xs text-muted-foreground">기기와 브라우저에 따라 메뉴 이름이 다를 수 있습니다. 보관한 후보와 질문 링크는 사용한 브라우저에 저장됩니다.</p>
    <details className="border-t pt-3"><summary className="text-sm font-semibold">Google Play 테스트 버전 이용</summary><p className="mt-2 text-xs text-muted-foreground">테스트 참여 권한이 있는 Google 계정에서 이용할 수 있습니다. 참여가 안 되면 위의 웹 이용 경로를 사용하세요.</p><a href={TESTING_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">테스터로 참여하고 설치하기</a></details>
  </Card>
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
