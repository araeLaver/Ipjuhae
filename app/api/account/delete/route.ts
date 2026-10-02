import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { transaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { clearAuthCookie } from '@/lib/auth'
import { eraseAccountData, DeletionReviewRequired } from '@/lib/account-erasure'
import { drainAccountStorageDeletes } from '@/lib/account-storage-delete'

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const userId = user.id

  try {
    const conversationIds = await transaction(client => eraseAccountData(client, userId, user.email))
    const io = (globalThis as Record<string, unknown>).io as { in: (room: string) => { disconnectSockets: (close: boolean) => void } } | undefined
    for (const id of conversationIds) io?.in(`conversation:${id}`).disconnectSockets(true)

    // DB commit precedes external deletion; failed objects remain durably queued.
    await drainAccountStorageDeletes().catch(() => undefined)
    logger.info('회원 삭제(탈퇴) 처리 완료', { userId })
    await clearAuthCookie()

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeletionReviewRequired) {
      return NextResponse.json({ error: '공유·보존 검토가 필요한 자료 또는 자동 정리가 어려운 저장 파일이 있어 자동 탈퇴를 완료할 수 없습니다. support@ipjuhae.com으로 삭제 요청을 보내주세요. 계정과 자료는 아직 변경되지 않았습니다.' }, { status: 409 })
    }
    logger.error('회원 삭제(탈퇴) 처리 중 오류', { userId, error })
    return NextResponse.json(
      { error: '회원 삭제(탈퇴) 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
