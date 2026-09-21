import subprocess

CWD = "/Volumes/WorkDrive/Develop/02_Ipjuhae"
MSG = """test(qa): DOW-1114 포그라운드 복귀 경로 회귀 테스트 + 실기기 수동 체크리스트

기존 notification-permission-sync 테스트는 service 함수를 직접 호출하므로
"앱이 그 함수를 다시 부르는가"를 보지 못한다. 그 호출을 일으키는 건
NotificationContext의 AppState 리스너 하나뿐이고, 사라지면 화면은 앱 재시작
전까지 켜진 것으로 거짓말을 한다.

- notification-foreground-resync.test.ts: Provider를 실제로 render해 리스너
  경로를 검증한다. 권한 해제 후 복귀 시 toggle OFF + 선호값 되돌림, 권한 유지
  시 상태 유지, 뒤로 가는 전환에서는 재조회 없음, 언마운트 시 리스너 정리.
  react/react-jsx-runtime은 external로 두어 테스트와 같은 React 인스턴스를 쓰고,
  jsdom realm에서 esbuild가 죽지 않도록 TextEncoder를 감싼 뒤 동적 import 한다.
- LAUNCH_CHECKLIST.md: 자동 검증이 닿지 않는 실기기 권한 변경 4항목 추가.

음성 검증: NotificationContext만 수정 이전으로 되돌리면 해당 2개 케이스가
실패하는 것을 확인했다.

검증: vitest 524 pass / 0 fail, tsc --noEmit 통과.

Co-Authored-By: Paperclip <noreply@paperclip.ing>
"""

files = [
    "__tests__/mobile/notification-foreground-resync.test.ts",
    "docs/LAUNCH_CHECKLIST.md",
    "docs/WORK_LOG_20260921_QA_DOW1114_VERIFICATION.md",
]
print(subprocess.run(["git", "add", "--"] + files, cwd=CWD, capture_output=True, text=True))
print(subprocess.run(["git", "commit", "-m", MSG], cwd=CWD, capture_output=True, text=True).stdout)
print(subprocess.run(["git", "log", "--oneline", "-2"], cwd=CWD, capture_output=True, text=True).stdout)
print(subprocess.run(["git", "status", "--short"], cwd=CWD, capture_output=True, text=True).stdout[:400])
