import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { evaluateReportAccess } from '@/lib/consent-access'
import {
  PROPERTY_SAFETY_FIELDS,
  buildPropertySafetyReport,
  loadProperty,
  loadPropertySafetyScore,
  parseContractStage,
  parsePurpose,
  parseRequestedFields,
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
    const property = await loadProperty(id)
    if (!property) {
      return NextResponse.json({ error: '주택 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const requestedFields = parseRequestedFields(searchParams, PROPERTY_SAFETY_FIELDS)
    const access = await evaluateReportAccess(request, {
      viewerUserId: viewer.id,
      ownerUserId: property.landlord_id,
      viewerRole: viewer.user_type,
      viewerIsAdmin: viewer.user_type === 'admin',
      targetType: 'property',
      targetId: property.id,
      targetPropertyId: property.id,
      requestedFields,
      purpose,
      contractStage: parseContractStage(searchParams),
    })

    if (!access.allowed) {
      return NextResponse.json(
        { error: '열람 동의가 필요합니다', reason: access.denialReason },
        { status: 403 },
      )
    }

    const safetyScore = await loadPropertySafetyScore(property.id)

    return NextResponse.json({
      allowedFields: access.allowedFields,
      accessLogId: access.accessLogId,
      report: buildPropertySafetyReport(property, safetyScore, access.allowedFields),
    })
  } catch (error) {
    console.error('Get property safety aggregate error:', error)
    return NextResponse.json({ error: '주택 안전 리포트 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
