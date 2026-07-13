import { createHash, randomBytes } from 'node:crypto'
import { query, queryOne, transaction } from './db'

export const CONTRACT_REPORT_DISCLAIMER =
  '이 리포트와 Trust Card는 제출자료의 확인상태를 정리한 참고자료입니다. 계약의 안전, 당사자의 신용, 문서의 진위 또는 법률적 결론을 보장하지 않습니다. 기준일, 미확인 항목과 추가 확인사항을 함께 검토해야 합니다.'

type SubjectType = 'tenant' | 'landlord' | 'property' | 'broker'
type RequesterRole = 'tenant' | 'landlord' | 'broker'

interface ChecklistTemplate {
  subjectType: SubjectType
  category: string
  key: string
  label: string
  nextAction: string
  sensitivity: 'public' | 'restricted' | 'sensitive'
}

const CHECKLIST: ChecklistTemplate[] = [
  { subjectType: 'tenant', category: 'identity', key: 'identity_check', label: '본인확인', nextAction: '본인확인 결과의 기준일과 식별 일치 여부를 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'tenant', category: 'employment', key: 'employment_check', label: '재직 확인', nextAction: '재직증명서의 발급처와 발급일을 원문과 대조하세요.', sensitivity: 'sensitive' },
  { subjectType: 'tenant', category: 'income', key: 'income_range', label: '소득 범위 확인', nextAction: '정확한 금액 대신 계약 검토에 필요한 범위값만 공개하세요.', sensitivity: 'sensitive' },
  { subjectType: 'tenant', category: 'reference', key: 'previous_landlord_reference', label: '이전 임대인 레퍼런스', nextAction: '검증된 거래와 연결된 응답인지 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'landlord', category: 'identity', key: 'identity_check', label: '본인확인', nextAction: '계약 상대방과 본인확인 결과가 일치하는지 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'landlord', category: 'ownership', key: 'owner_match', label: '소유자 일치', nextAction: '등기상 소유자와 계약 상대방 또는 적법한 대리권을 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'landlord', category: 'rights', key: 'rights_cooperation', label: '권리관계 확인 협조', nextAction: '근저당, 압류, 가압류 등 추가 확인이 필요한 권리를 검토하세요.', sensitivity: 'restricted' },
  { subjectType: 'landlord', category: 'reference', key: 'previous_tenant_reference', label: '이전 임차인 레퍼런스', nextAction: '정정과 반론 상태를 포함해 응답을 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'property', category: 'registry', key: 'registry_record', label: '등기부등본', nextAction: '최신 등기부의 소유자와 제한물권을 다시 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'property', category: 'building', key: 'building_ledger', label: '건축물대장', nextAction: '용도, 면적과 위반건축물 표시를 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'property', category: 'price', key: 'transaction_price', label: '실거래가 기준', nextAction: '동일 또는 유사 목적물의 기준일과 가격 범위를 확인하세요.', sensitivity: 'public' },
  { subjectType: 'property', category: 'price', key: 'assessed_price', label: '공시가격 기준', nextAction: '최신 공시가격 기준일을 확인하세요.', sensitivity: 'public' },
  { subjectType: 'property', category: 'guarantee', key: 'guarantee_check', label: '보증보험 확인 항목', nextAction: '보증 가능 여부를 단정하지 말고 해당 기관 기준을 직접 확인하세요.', sensitivity: 'restricted' },
  { subjectType: 'broker', category: 'consultation', key: 'submission_checklist', label: '제출자료 현황', nextAction: '미제출 자료와 추가 질문을 당사자에게 안내하세요.', sensitivity: 'restricted' },
  { subjectType: 'broker', category: 'consultation', key: 'consultation_note', label: '상담 및 설명 기록', nextAction: '설명한 항목, 미확인 사항과 열람 목적을 기록하세요.', sensitivity: 'restricted' },
]

interface CreateReportInput {
  organizationId?: string | null
  transactionId?: string | null
  propertyId?: string | null
  tenantId?: string | null
  landlordId?: string | null
  realtorId?: string | null
  requesterRole: RequesterRole
  title: string
  contractAddress?: string | null
  contractStage?: string
  expiresAt?: string | null
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function reportAccessSql(admin: boolean) {
  if (admin) return 'SELECT report.* FROM contract_check_reports report WHERE report.id = $1'
  return (
    'SELECT report.* FROM contract_check_reports report ' +
    'WHERE report.id = $1 AND (' +
    'report.owner_id = $2 OR report.tenant_id = $2 OR report.landlord_id = $2 OR report.realtor_id = $2 OR ' +
    'EXISTS (SELECT 1 FROM trust_organization_memberships member ' +
    'WHERE member.organization_id = report.organization_id AND member.user_id = $2 AND member.status = \'active\')' +
    ')'
  )
}

async function accessibleReport(reportId: string, actorId: string, admin = false) {
  return queryOne<Record<string, unknown>>(reportAccessSql(admin), admin ? [reportId] : [reportId, actorId])
}

export async function createContractReport(actorId: string, input: CreateReportInput) {
  return transaction(async (client) => {
    if (input.organizationId) {
      const membership = await client.query(
        'SELECT 1 FROM trust_organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = \'active\'',
        [input.organizationId, actorId]
      )
      if (membership.rowCount === 0) throw new Error('ORGANIZATION_ACCESS_DENIED')
    }

    if (input.transactionId) {
      const context = await client.query(
        'SELECT id FROM trust_transaction_contexts WHERE id = $1 AND ($2 = landlord_id OR $2 = tenant_id OR $2 = realtor_id)',
        [input.transactionId, actorId]
      )
      if (context.rowCount === 0) throw new Error('TRANSACTION_ACCESS_DENIED')
    }

    const tenantId = input.tenantId ?? (input.requesterRole === 'tenant' ? actorId : null)
    const landlordId = input.landlordId ?? (input.requesterRole === 'landlord' ? actorId : null)
    const realtorId = input.realtorId ?? (input.requesterRole === 'broker' ? actorId : null)

    const inserted = await client.query(
      'INSERT INTO contract_check_reports ' +
      '(owner_id, organization_id, transaction_id, property_id, tenant_id, landlord_id, realtor_id, requester_role, title, contract_address, contract_stage, expires_at) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [
        actorId,
        input.organizationId ?? null,
        input.transactionId ?? null,
        input.propertyId ?? null,
        tenantId,
        landlordId,
        realtorId,
        input.requesterRole,
        input.title,
        input.contractAddress ?? null,
        input.contractStage ?? 'pre_contract',
        input.expiresAt ?? null,
      ]
    )
    const report = inserted.rows[0]

    for (let index = 0; index < CHECKLIST.length; index += 1) {
      const item = CHECKLIST[index]
      const subjectId =
        item.subjectType === 'tenant'
          ? tenantId
          : item.subjectType === 'landlord'
            ? landlordId
            : item.subjectType === 'property'
              ? input.propertyId
              : realtorId
      await client.query(
        'INSERT INTO contract_check_items ' +
        '(report_id, subject_type, subject_id, category, item_key, label, verification_status, sensitivity, missing_reason, next_action, display_order) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,\'MISSING\',$7,$8,$9,$10)',
        [
          report.id,
          item.subjectType,
          subjectId ?? null,
          item.category,
          item.key,
          item.label,
          item.sensitivity,
          '자료가 제출되지 않았거나 운영자 검수가 완료되지 않았습니다.',
          item.nextAction,
          index + 1,
        ]
      )
    }

    return report
  })
}

export async function listContractReports(actorId: string) {
  return query<Record<string, unknown>>(
    'SELECT report.*, ' +
    '(SELECT COUNT(*)::int FROM contract_check_items item WHERE item.report_id = report.id) AS item_count, ' +
    '(SELECT COUNT(*)::int FROM contract_check_items item WHERE item.report_id = report.id AND item.verification_status = \'VERIFIED\') AS verified_count, ' +
    '(SELECT COUNT(*)::int FROM contract_check_items item WHERE item.report_id = report.id AND item.verification_status IN (\'MISSING\',\'REVIEW_REQUIRED\',\'EXPIRED\')) AS attention_count ' +
    'FROM contract_check_reports report WHERE ' +
    'report.owner_id = $1 OR report.tenant_id = $1 OR report.landlord_id = $1 OR report.realtor_id = $1 OR ' +
    'EXISTS (SELECT 1 FROM trust_organization_memberships member WHERE member.organization_id = report.organization_id AND member.user_id = $1 AND member.status = \'active\') ' +
    'ORDER BY report.created_at DESC LIMIT 100',
    [actorId]
  )
}

export async function listAllContractReports() {
  return query<Record<string, unknown>>(
    'SELECT report.*, user_row.email AS owner_email, organization.name AS organization_name, ' +
    '(SELECT COUNT(*)::int FROM contract_check_items item WHERE item.report_id = report.id AND item.review_state = \'pending\') AS pending_review_count ' +
    'FROM contract_check_reports report ' +
    'JOIN users user_row ON user_row.id = report.owner_id ' +
    'LEFT JOIN trust_organizations organization ON organization.id = report.organization_id ' +
    'ORDER BY report.created_at DESC LIMIT 200'
  )
}

export async function getContractReport(actorId: string, reportId: string, admin = false) {
  const report = await accessibleReport(reportId, actorId, admin)
  if (!report) throw new Error('CONTRACT_REPORT_NOT_FOUND')
  const items = await query<Record<string, unknown>>(
    'SELECT * FROM contract_check_items WHERE report_id = $1 ORDER BY subject_type, display_order, created_at',
    [reportId]
  )
  return { ...report, items, disclaimer: CONTRACT_REPORT_DISCLAIMER, can_review: admin }
}

interface ReportItemUpdate {
  verificationStatus: 'VERIFIED' | 'REVIEW_REQUIRED' | 'MISSING' | 'EXPIRED' | 'REJECTED'
  sourceType?: string | null
  sourceName?: string | null
  sourceRef?: string | null
  sourceObservedAt?: string | null
  validUntil?: string | null
  publicValue?: unknown
  missingReason?: string | null
  nextAction?: string | null
  reviewState?: 'pending' | 'approved' | 'rejected'
  notes?: string | null
}

export async function updateContractReportItem(
  actorId: string,
  reportId: string,
  itemId: string,
  input: ReportItemUpdate,
  admin = false
) {
  const report = await accessibleReport(reportId, actorId, admin)
  if (!report) throw new Error('CONTRACT_REPORT_NOT_FOUND')
  const reviewState = admin ? input.reviewState ?? 'pending' : 'pending'
  const item = await queryOne<Record<string, unknown>>(
    'UPDATE contract_check_items SET ' +
    'verification_status = $4, source_type = $5, source_name = $6, source_ref = $7, ' +
    'source_observed_at = $8, valid_until = $9, public_value = $10::jsonb, missing_reason = $11, ' +
    'next_action = $12, review_state = $13, reviewer_id = CASE WHEN $13 = \'pending\' THEN NULL ELSE $3::uuid END, ' +
    'reviewed_at = CASE WHEN $13 = \'pending\' THEN NULL ELSE NOW() END, notes = $14, updated_at = NOW() ' +
    'WHERE id = $1 AND report_id = $2 RETURNING *',
    [
      itemId,
      reportId,
      actorId,
      input.verificationStatus,
      input.sourceType ?? null,
      input.sourceName ?? null,
      input.sourceRef ?? null,
      input.sourceObservedAt ?? null,
      input.validUntil ?? null,
      JSON.stringify(input.publicValue ?? null),
      input.missingReason ?? null,
      input.nextAction ?? null,
      reviewState,
      input.notes ?? null,
    ]
  )
  if (!item) throw new Error('CONTRACT_REPORT_ITEM_NOT_FOUND')
  await query('UPDATE contract_check_reports SET updated_at = NOW() WHERE id = $1', [reportId])
  return item
}

const TRANSITIONS: Record<string, string[]> = {
  draft: ['in_review', 'revoked'],
  in_review: ['draft', 'ready', 'revoked'],
  ready: ['in_review', 'shared', 'expired', 'revoked'],
  shared: ['ready', 'expired', 'revoked'],
  revoked: [],
  expired: [],
}

export async function transitionContractReport(
  actorId: string,
  reportId: string,
  nextStatus: string,
  admin = false
) {
  const report = await accessibleReport(reportId, actorId, admin)
  if (!report) throw new Error('CONTRACT_REPORT_NOT_FOUND')
  const current = String(report.status)
  if (!(TRANSITIONS[current] ?? []).includes(nextStatus)) throw new Error('CONTRACT_REPORT_INVALID_TRANSITION')
  if (nextStatus === 'ready' && !admin) throw new Error('CONTRACT_REPORT_REVIEW_REQUIRED')
  if (nextStatus === 'ready') {
    const pending = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM contract_check_items WHERE report_id = $1 AND review_state = \'pending\'',
      [reportId]
    )
    if ((pending?.count ?? 0) > 0) throw new Error('CONTRACT_REPORT_REVIEW_INCOMPLETE')
  }
  return queryOne<Record<string, unknown>>(
    'UPDATE contract_check_reports SET status = $2, generated_at = CASE WHEN $2 = \'ready\' THEN NOW() ELSE generated_at END, updated_at = NOW() WHERE id = $1 RETURNING *',
    [reportId, nextStatus]
  )
}

interface CreateCardInput {
  reportId: string
  subjectType: 'tenant' | 'landlord' | 'property' | 'broker' | 'combined'
  subjectId?: string | null
  title: string
  audienceRole: 'tenant' | 'landlord' | 'broker' | 'institution' | 'private_recipient'
  purpose: string
  fieldKeys: string[]
  expiresAt: string
}

export async function createTrustCard(actorId: string, input: CreateCardInput) {
  const report = await accessibleReport(input.reportId, actorId)
  if (!report) throw new Error('CONTRACT_REPORT_NOT_FOUND')
  if (!['ready', 'shared'].includes(String(report.status))) throw new Error('CONTRACT_REPORT_NOT_READY')
  const allowed = await query<{ item_key: string }>(
    'SELECT DISTINCT item_key FROM contract_check_items WHERE report_id = $1 AND review_state = \'approved\' AND item_key = ANY($2::text[]) AND ($3 = \'combined\' OR subject_type = $3)',
    [input.reportId, input.fieldKeys, input.subjectType]
  )
  if (allowed.length !== new Set(input.fieldKeys).size) throw new Error('TRUST_CARD_FIELD_NOT_APPROVED')

  const token = randomBytes(32).toString('base64url')
  const card = await queryOne<Record<string, unknown>>(
    'INSERT INTO trust_cards ' +
    '(owner_id, report_id, subject_type, subject_id, title, audience_role, purpose, field_keys, share_token_hash, token_prefix, expires_at) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [
      actorId,
      input.reportId,
      input.subjectType,
      input.subjectId ?? null,
      input.title,
      input.audienceRole,
      input.purpose,
      [...new Set(input.fieldKeys)],
      hash(token),
      token.slice(0, 8),
      input.expiresAt,
    ]
  )
  await query('UPDATE contract_check_reports SET status = \'shared\', updated_at = NOW() WHERE id = $1 AND status = \'ready\'', [input.reportId])
  return { card, share_token: token }
}

export async function listTrustCards(actorId: string) {
  return query<Record<string, unknown>>(
    'SELECT card.*, report.title AS report_title, ' +
    '(SELECT COUNT(*)::int FROM trust_card_access_logs access_log WHERE access_log.card_id = card.id AND access_log.decision = \'allowed\') AS allowed_views ' +
    'FROM trust_cards card JOIN contract_check_reports report ON report.id = card.report_id ' +
    'WHERE card.owner_id = $1 ORDER BY card.created_at DESC LIMIT 100',
    [actorId]
  )
}

export async function revokeTrustCard(actorId: string, cardId: string) {
  const card = await queryOne<Record<string, unknown>>(
    'UPDATE trust_cards SET status = \'revoked\', revoked_at = NOW(), updated_at = NOW() ' +
    'WHERE id = $1 AND owner_id = $2 AND status = \'issued\' RETURNING *',
    [cardId, actorId]
  )
  if (!card) throw new Error('TRUST_CARD_NOT_FOUND')
  return card
}

export async function getPublicTrustCard(
  token: string,
  actorId: string | null,
  purpose: string | null,
  ipAddress: string | null,
  userAgent: string | null
) {
  const tokenHash = hash(token)
  const card = await queryOne<Record<string, unknown>>(
    'SELECT card.*, report.contract_address, report.title AS report_title ' +
    'FROM trust_cards card JOIN contract_check_reports report ON report.id = card.report_id ' +
    'WHERE card.share_token_hash = $1',
    [tokenHash]
  )
  if (!card) throw new Error('TRUST_CARD_NOT_FOUND')
  const expired = new Date(String(card.expires_at)).getTime() <= Date.now()
  const decision = card.status === 'revoked' ? 'revoked' : expired ? 'expired' : card.status === 'issued' ? 'allowed' : 'denied'
  await query(
    'INSERT INTO trust_card_access_logs (card_id, actor_user_id, purpose, decision, ip_hash, user_agent) VALUES ($1,$2,$3,$4,$5,$6)',
    [card.id, actorId, purpose, decision, ipAddress ? hash(ipAddress) : null, userAgent?.slice(0, 500) ?? null]
  )
  if (decision !== 'allowed') throw new Error(decision === 'expired' ? 'TRUST_CARD_EXPIRED' : 'TRUST_CARD_REVOKED')
  const items = await query<Record<string, unknown>>(
    'SELECT subject_type, category, item_key, label, verification_status, source_name, source_observed_at, valid_until, public_value, missing_reason, next_action ' +
    'FROM contract_check_items WHERE report_id = $1 AND item_key = ANY($2::text[]) AND review_state = \'approved\' AND ($3 = \'combined\' OR subject_type = $3) ' +
    'ORDER BY subject_type, display_order',
    [card.report_id, card.field_keys, card.subject_type]
  )
  return { card, items, disclaimer: CONTRACT_REPORT_DISCLAIMER }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export async function buildPrintableContractReport(actorId: string, reportId: string, admin = false) {
  const report = await getContractReport(actorId, reportId, admin)
  const items = report.items as Record<string, unknown>[]
  const groups = ['tenant', 'landlord', 'property', 'broker']
    .map((subject) => {
      const rows = items
        .filter((item) => item.subject_type === subject)
        .map(
          (item) =>
            '<tr><td>' + escapeHtml(item.label) + '</td><td><strong>' +
            escapeHtml(item.verification_status) + '</strong></td><td>' +
            escapeHtml(displayValue(item.public_value)) + '</td><td>' +
            escapeHtml(item.source_name) + '</td><td>' +
            escapeHtml(item.source_observed_at) + '</td><td>' +
            escapeHtml(item.missing_reason) + '</td><td>' +
            escapeHtml(item.next_action) + '</td></tr>'
        )
        .join('')
      if (!rows) return ''
      return '<section><h2>' + escapeHtml(subject.toUpperCase()) +
        '</h2><table><thead><tr><th>확인항목</th><th>상태</th><th>공개값</th><th>출처</th><th>기준일</th><th>미확인 사유</th><th>다음 행동</th></tr></thead><tbody>' +
        rows + '</tbody></table></section>'
    })
    .join('')

  return (
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(report.title) + '</title><style>' +
    '@page{size:A4;margin:14mm}body{font-family:"Malgun Gothic",sans-serif;color:#17211b;margin:0}header{border-bottom:4px solid #d86b3f;padding-bottom:16px;margin-bottom:20px}' +
    'h1{font-family:Georgia,serif;font-size:28px;margin:0 0 8px}h2{font-size:17px;margin:24px 0 8px;color:#7a351f}p{line-height:1.6}table{border-collapse:collapse;width:100%;font-size:10px;table-layout:fixed}' +
    'th,td{border:1px solid #c8cfc9;padding:6px;vertical-align:top;word-break:break-word}th{background:#f3eee4;text-align:left}.meta{color:#526057;font-size:12px}.notice{margin-top:24px;padding:14px;background:#fff4df;border:1px solid #e1c896;font-size:11px}.print{position:fixed;right:20px;top:20px}@media print{.print{display:none}}' +
    '</style></head><body><button class="print" onclick="window.print()">PDF로 인쇄</button><header><h1>' +
    escapeHtml(report.title) + '</h1><div class="meta">계약 대상: ' + escapeHtml(report.contract_address) +
    ' | 상태: ' + escapeHtml(report.status) + ' | 생성시각: ' + escapeHtml(report.generated_at ?? report.created_at) +
    '</div></header>' + groups + '<div class="notice"><strong>책임 제한</strong><br>' +
    escapeHtml(CONTRACT_REPORT_DISCLAIMER) + '</div></body></html>'
  )
}

interface DocumentIntakeInput {
  subjectType: 'tenant' | 'landlord' | 'property'
  subjectId: string
  originalFilename: string
  mediaType: string
  byteSize: number
  fileSha256: string
  storageRef: string
  sourceKind?: 'user_upload' | 'public_record' | 'partner_api' | 'operator_upload'
  metadata?: Record<string, unknown>
}

export async function registerDocumentIntake(actorId: string, input: DocumentIntakeInput) {
  return queryOne<Record<string, unknown>>(
    'INSERT INTO document_intakes ' +
    '(owner_user_id, subject_type, subject_id, original_filename, media_type, byte_size, file_sha256, storage_ref, source_kind, metadata) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ' +
    'ON CONFLICT (owner_user_id, file_sha256, storage_ref) DO UPDATE SET updated_at = NOW() RETURNING *',
    [
      actorId,
      input.subjectType,
      input.subjectId,
      input.originalFilename,
      input.mediaType,
      input.byteSize,
      input.fileSha256.toLowerCase(),
      input.storageRef,
      input.sourceKind ?? 'user_upload',
      JSON.stringify(input.metadata ?? {}),
    ]
  )
}

export async function listDocumentIntakes(actorId: string) {
  return query<Record<string, unknown>>(
    'SELECT * FROM document_intakes WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [actorId]
  )
}

interface AiRunInput {
  organizationId?: string | null
  extractionJobId?: string | null
  purpose: string
  provider: string
  modelName: string
  modelVersion?: string | null
  policyVersion?: string | null
  inputHash: string
  outputHash?: string | null
  containsPersonalData?: boolean
  consentId?: string | null
  status?: string
  costAmount?: number | null
}

export async function recordAiProcessingRun(actorId: string, input: AiRunInput) {
  if (input.containsPersonalData && !input.consentId) throw new Error('AI_RUN_CONSENT_REQUIRED')
  return queryOne<Record<string, unknown>>(
    'INSERT INTO ai_processing_runs ' +
    '(owner_user_id, organization_id, extraction_job_id, purpose, provider, model_name, model_version, policy_version, input_hash, output_hash, contains_personal_data, consent_id, status, cost_amount, completed_at) ' +
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $13 IN (\'completed\',\'failed\',\'cancelled\') THEN NOW() ELSE NULL END) RETURNING *',
    [
      actorId,
      input.organizationId ?? null,
      input.extractionJobId ?? null,
      input.purpose,
      input.provider,
      input.modelName,
      input.modelVersion ?? null,
      input.policyVersion ?? null,
      input.inputHash.toLowerCase(),
      input.outputHash?.toLowerCase() ?? null,
      input.containsPersonalData ?? false,
      input.consentId ?? null,
      input.status ?? 'requested',
      input.costAmount ?? null,
    ]
  )
}

export async function listAiProcessingRuns(actorId: string) {
  return query<Record<string, unknown>>(
    'SELECT * FROM ai_processing_runs WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [actorId]
  )
}

export async function createOrganization(
  actorId: string,
  input: { name: string; organizationType: string; businessNumber?: string | null; metadata?: Record<string, unknown> }
) {
  return transaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO trust_organizations (name, organization_type, business_number, created_by, metadata) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *',
      [input.name, input.organizationType, input.businessNumber ?? null, actorId, JSON.stringify(input.metadata ?? {})]
    )
    const organization = inserted.rows[0]
    await client.query(
      'INSERT INTO trust_organization_memberships (organization_id, user_id, member_role, status, invited_by) VALUES ($1,$2,\'owner\',\'active\',$2)',
      [organization.id, actorId]
    )
    return organization
  })
}

export async function listOrganizations(actorId: string) {
  return query<Record<string, unknown>>(
    'SELECT organization.*, membership.member_role FROM trust_organizations organization ' +
    'JOIN trust_organization_memberships membership ON membership.organization_id = organization.id ' +
    'WHERE membership.user_id = $1 AND membership.status = \'active\' ORDER BY organization.created_at DESC',
    [actorId]
  )
}

export async function addOrganizationMember(
  actorId: string,
  organizationId: string,
  userId: string,
  memberRole: string
) {
  const authorized = await queryOne(
    'SELECT 1 FROM trust_organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = \'active\' AND member_role IN (\'owner\',\'admin\')',
    [organizationId, actorId]
  )
  if (!authorized) throw new Error('ORGANIZATION_ADMIN_REQUIRED')
  return queryOne<Record<string, unknown>>(
    'INSERT INTO trust_organization_memberships (organization_id, user_id, member_role, status, invited_by) ' +
    'VALUES ($1,$2,$3,\'active\',$4) ON CONFLICT (organization_id,user_id) DO UPDATE SET member_role = EXCLUDED.member_role, status = \'active\', updated_at = NOW() RETURNING *',
    [organizationId, userId, memberRole, actorId]
  )
}
