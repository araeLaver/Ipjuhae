#!/bin/bash
# DOW-1186: QA용 preview APK 로컬 빌드 (gradle 단계만 — prebuild는 이미 끝남).
# EAS 원격 빌드는 무료 월간 할당량이 소진돼 로컬로 만든다.
# JDK는 Android Studio 번들 JBR 21을 쓴다 — 시스템 기본은 JDK 25라 AGP가 거부한다.
set -euo pipefail

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
unset NODE_ENV

cd /Volumes/WorkDrive/Develop/02_Ipjuhae/mobile/android

echo "### gradle assembleRelease 시작 $(date +%H:%M:%S)"
./gradlew assembleRelease --no-daemon --console=plain

echo "### 산출물 $(date +%H:%M:%S)"
find . -name "*.apk" -print
