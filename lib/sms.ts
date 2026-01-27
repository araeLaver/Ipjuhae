/**
 * SMS 발송 Mock 함수
 * 실제 서비스에서는 NHN Cloud, AWS SNS 등의 SMS API를 사용
 */

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  // Mock: 실제로는 SMS를 보내지 않고 콘솔에 출력
  console.log('=== SMS 발송 (Mock) ===')
  console.log('수신번호:', phoneNumber)
  console.log('내용:', message)
  console.log('========================')

  // 시뮬레이션을 위해 약간의 지연 추가
  await new Promise(resolve => setTimeout(resolve, 500))

  // 항상 성공 반환 (Mock)
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  }
}

/**
 * 레퍼런스 요청 SMS 발송
 */
export async function sendReferenceRequestSMS(
  landlordPhone: string,
  tenantName: string,
  surveyUrl: string
): Promise<SMSResult> {
  const message = `[입주해] ${tenantName}님이 레퍼런스를 요청했습니다. 아래 링크에서 설문에 응해주세요: ${surveyUrl}`

  return sendSMS(landlordPhone, message)
}
