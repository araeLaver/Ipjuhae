import { dispatchSavedSearchAlerts } from '@/lib/saved-search-alerts'
import { logger } from '@/lib/logger'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError(request, 401, 'Invalid cron authorization', 'CRON_AUTH_INVALID')
  }
  if (process.env.SAVED_SEARCH_ALERTS_ENABLED !== 'true') return jsonSuccess(request, { enabled: false, checked: 0, notifications: 0 })
  try { return jsonSuccess(request, await dispatchSavedSearchAlerts()) }
  catch (error) {
    logger.error('저장 검색 알림 처리 실패', { error })
    return jsonError(request, 500, '알림 처리에 실패했습니다', 'SAVED_SEARCH_DISPATCH_FAILED')
  }
}
