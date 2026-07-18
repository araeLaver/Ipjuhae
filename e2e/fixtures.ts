import { expect, test as base } from '@playwright/test'

type E2EFixtures = {
  blockAnalytics: void
}

export const test = base.extend<E2EFixtures>({
  blockAnalytics: [
    async ({ context }, use) => {
      await context.route('**/api/analytics/event', async (route) => {
        await route.fulfill({ status: 204 })
      })

      await use()
    },
    { auto: true },
  ],
})

export { expect }
