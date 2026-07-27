import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { evaluateReportAccess } from '@/lib/consent-access'
import {
  TENANT_TRUST_FIELDS,
  buildProfileTrustReport,
  loadProfileReportData,
  parseContractStage,
  parsePurpose,
  parseRequestedFields,
  recordReportDisclosureSnapshot,
} from '@/lib/report-aggregate'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentUser()
  if (!viewer) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const purpose = parsePurpose(searchParams)
  if (!purpose) {
    return NextResponse.json({ error: 'purpose가 필요합니다' }, { status: 400 })
  }

  try {
    const { id } = await params
    const data = await loadProfileReportData(id, 'tenant')
    if (!data) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    const requestedFields = parseRequestedFields(searchParams, TENANT_TRUST_FIELDS)
    const contractStage = parseContractStage(searchParams)
    const access = await evaluateReportAccess(request, {
      viewerUserId: viewer.id,
      ownerUserId: data.profile.user_id,
      viewerRole: viewer.user_type,
      viewerIsAdmin: viewer.user_type === 'admin',
      targetType: 'profile',
      targetId: data.profile.id,
      requestedFields,
      purpose,
      contractStage,
    })

    if (!access.allowed) {
      const disclosure = await recordReportDisclosureSnapshot({
        access,
        ownerUserId: data.profile.user_id,
        viewerUserId: viewer.id,
        viewerRole: viewer.user_type,
        targetType: 'profile',
        targetId: data.profile.id,
        requestedFields,
        purpose,
        contractStage,
        reportType: 'tenant_trust',
      })

      return NextResponse.json(
        {
          error: '열람 동의가 필요합니다',
          reason: access.denialReason,
          disclosureDecisionId: disclosure.disclosureDecisionId,
        },
        { status: 403 },
      )
    }

    const report = buildProfileTrustReport(data, access.allowedFields, 'tenant_trust')
    const disclosure = await recordReportDisclosureSnapshot({
      access,
      ownerUserId: data.profile.user_id,
      viewerUserId: viewer.id,
      viewerRole: viewer.user_type,
      targetType: 'profile',
      targetId: data.profile.id,
      requestedFields,
      purpose,
      contractStage,
      reportType: 'tenant_trust',
      reportSnapshot: report,
    })

    return NextResponse.json({
      allowedFields: access.allowedFields,
      accessLogId: access.accessLogId,
      disclosureDecisionId: disclosure.disclosureDecisionId,
      reportBundleId: disclosure.reportBundleId,
      report,
    })
  } catch (error) {
    console.error('Get tenant trust aggregate error:', error)
    return NextResponse.json({ error: '임차인 신뢰 리포트 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
