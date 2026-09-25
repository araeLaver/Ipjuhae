/**
 * app.json 위에 `android.googleServicesFile`만 얹는다.
 *
 * 왜 이 파일이 있나 (DOW-1222):
 * Android에서 expo-notifications가 푸시 토큰을 받으려면 Firebase 초기화가 필요하고,
 * 그 초기화는 빌드에 포함된 `google-services.json`에서 온다. 이 파일이 없으면
 * 권한을 허용해도 토큰 발급 자체가 불가능하다 — 실제로 운영 `push_tokens`는
 * 단 한 행도 생긴 적이 없다.
 *
 * 그런데 `google-services.json`은 저장소에 올릴 수 없다. 이 저장소는 public이고,
 * 그 파일에는 Firebase API key와 sender ID가 들어 있다. 그래서:
 *
 * - 로컬: `mobile/google-services.json`에 두면 자동으로 잡힌다(.gitignore 처리됨)
 * - EAS:  file 타입 환경변수 `GOOGLE_SERVICES_JSON`이 빌드 머신의 경로를 넘긴다
 *
 * 파일이 없으면 `googleServicesFile`을 아예 넣지 않는다. 존재하지 않는 경로를
 * 가리키면 prebuild가 그 자리에서 깨지기 때문이다. 다만 **조용히** 넘어가면
 * 이 이슈가 처음 생긴 방식 그대로 "푸시 없는 빌드"가 다시 나온다. 그래서
 * 경고를 남기고, 스토어에 올라가는 Android production 빌드에서는 실패시킨다.
 *
 * 설정 절차: docs/mobile-fcm-setup.md
 */

const fs = require('fs');
const path = require('path');

const LOCAL_FILENAME = 'google-services.json';

function resolveGoogleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const local = path.join(__dirname, LOCAL_FILENAME);
  if (fs.existsSync(local)) return `./${LOCAL_FILENAME}`;

  return null;
}

module.exports = ({ config }) => {
  const googleServicesFile = resolveGoogleServicesFile();

  if (googleServicesFile) {
    return { ...config, android: { ...config.android, googleServicesFile } };
  }

  const isAndroidBuild = process.env.EAS_BUILD_PLATFORM === 'android';
  const isProductionProfile = process.env.EAS_BUILD_PROFILE === 'production';

  if (isAndroidBuild && isProductionProfile) {
    throw new Error(
      'google-services.json이 없어 Android 푸시 토큰을 발급할 수 없습니다. ' +
        'EAS에 file 타입 환경변수 GOOGLE_SERVICES_JSON을 등록해 주세요. ' +
        '절차: docs/mobile-fcm-setup.md (DOW-1222)'
    );
  }

  console.warn(
    '[app.config] google-services.json 없음 — 이 빌드에서는 Android 푸시 토큰이 발급되지 않습니다. ' +
      '알림 체크리스트의 push_tokens 항목은 판정 불가입니다. 절차: docs/mobile-fcm-setup.md (DOW-1222)'
  );

  return config;
};
