import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    // 현재 테스트는 전부 서버 사이드(app/api, lib)라 node 환경으로 실행한다.
    // jsdom으로 돌리면 crypto 등 Node 내장 모듈이 브라우저용으로 externalize되어
    // Node 26에서 "No such built-in module: node:"로 스위트가 통째로 죽는다.
    // 컴포넌트 테스트를 추가할 때는 해당 파일 상단에 `// @vitest-environment jsdom`을 붙인다.
    environment: 'node',
    // 셸에 NODE_ENV=production이 떠 있어도 테스트는 항상 test로 돌게 고정한다.
    // (고정하지 않으면 jwt/verification의 운영 가드가 테스트에서 터진다)
    env: { NODE_ENV: 'test' },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/.claude/worktrees/**', '**/node_modules/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // 앱(mobile/) 소스를 여기서 테스트하기 위한 스텁. Expo 런타임은 올리지 않는다.
      'expo-constants': path.resolve(__dirname, './__tests__/stubs/expo-constants.ts'),
    },
  },
})
