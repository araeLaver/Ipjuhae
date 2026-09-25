#!/bin/bash
# DOW-1173: 비운영(로컬 endpoint) QA APK 빌드. CEO 승인 범위.
#
# 두 가지를 반드시 같이 해야 한다.
# 1) EXPO_PUBLIC_API_BASE_URL — Expo가 번들 시점에 인라인하므로 gradle 단계까지 떠 있어야 한다.
# 2) cleartext 허용 — Android 9+ 는 평문 HTTP를 기본 차단한다. 이걸 빼면 앱이 로컬에
#    "조용히 못 붙는다". app.json을 건드리지 않고 prebuild 산출물 manifest만 패치한다
#    (mobile/android/ 는 gitignore 대상이라 저장소에 안 남고, 운영 빌드에 샐 수 없다).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/qa-env.sh"

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
unset NODE_ENV

export EXPO_PUBLIC_API_BASE_URL="$QA_API_BASE"

cd "$REPO_ROOT/mobile"

echo "### endpoint = $EXPO_PUBLIC_API_BASE_URL"
echo "### prebuild"
npx expo prebuild --platform android --no-install

MANIFEST=android/app/src/main/AndroidManifest.xml
echo "### cleartext 허용 패치"
python3 - "$MANIFEST" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
if 'usesCleartextTraffic' in s:
    print('  이미 있음')
else:
    s = s.replace('<application ', '<application android:usesCleartextTraffic="true" ', 1)
    open(p, 'w', encoding='utf-8').write(s)
    print('  추가함')
PY
grep -o 'usesCleartextTraffic="[a-z]*"' "$MANIFEST" | head -1

cd android

# EXPO_PUBLIC_* 는 gradle의 입력으로 추적되지 않는다. 그래서 endpoint만 바꿔 다시 돌리면
# bundle 태스크가 UP-TO-DATE로 건너뛰고 **이전 endpoint가 박힌 APK가 그대로 남는다.**
# 실제로 한 번 당했다(58439가 박힌 APK를 3007 빌드로 착각). 번들 산출물을 지워서 강제한다.
echo "### 이전 번들 산출물 제거 (endpoint 변경은 gradle이 추적하지 않는다)"
rm -rf app/build/generated/assets app/build/intermediates/assets app/build/outputs/apk

echo "### gradle assembleRelease"
./gradlew assembleRelease --no-daemon --console=plain -q

APK=app/build/outputs/apk/release/app-release.apk
echo "### 산출물"
ls -la "$APK"

# 번들에 로컬 endpoint가 실제로 박혔는지 확인한다. 환경변수가 안 먹으면
# 조용히 운영 주소로 빌드되고, 그러면 7항목이 엉뚱한 백엔드에서 통과한다.
echo "### 번들 endpoint 검증"
python3 - "$APK" "$QA_API_BASE" <<'PY'
import sys, zipfile
apk, expect = sys.argv[1], sys.argv[2]
text = zipfile.ZipFile(apk).read('assets/index.android.bundle').decode('utf-8', 'replace')

# 대조군 먼저. Hermes 바이트코드에서 문자열 검색 자체가 안 되는 상황이면
# "없음"이 거짓 음성이 된다. 반드시 있어야 하는 문자열이 잡히는지부터 본다.
control = 'https://www.ipjuhae.com/terms'
print(f'  대조군({control}): {"찾음" if control in text else "없음"}')
if control not in text:
    raise SystemExit('FAIL: 대조군조차 못 찾는다 — 검사기가 죽었다. endpoint 판정을 믿을 수 없다')

print(f'  로컬 endpoint({expect}): {"찾음" if expect in text else "없음"}')
if expect not in text:
    raise SystemExit('FAIL: 번들에 로컬 endpoint가 없다 — EXPO_PUBLIC_API_BASE_URL이 안 먹었다')
print('  OK — 번들이 로컬 endpoint를 가리킨다')
PY
