/**
 * `expo-constants` 스텁.
 *
 * 앱 소스(`mobile/`)는 Expo 런타임에서 돌지만, 웹 저장소의 vitest는 node에서 돈다.
 * 앱 코드 한 줄을 테스트하려고 Expo 전체를 올릴 필요는 없으므로 이 모듈만 대체한다.
 * vitest.config.ts의 alias가 이 파일을 가리킨다.
 */

export default {
  expoConfig: {
    extra: {
      apiBaseUrl: 'https://www.ipjuhae.com/api',
    },
  },
}
