/**
 * SMS 발송 모듈
 *
 * 지원 프로바이더:
 * - mock: 개발/테스트용 (콘솔 출력)
 * - nhn: NHN Cloud SMS
 * - twilio: Twilio
 *
 * 환경변수:
 * - SMS_PROVIDER: 'mock' | 'nhn' | 'twilio' (기본: mock)
 */

import { logger } from './logger'

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

type SMSProvider = 'mock' | 'nhn' | 'twilio'

const SMS_PROVIDER = (process.env.SMS_PROVIDER as SMSProvider) || 'mock'

/**
 * Mock SMS 발송 (개발용)
 */
async function sendMockSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  logger.info('SMS 발송 (Mock)', { phoneNumber, message })
  await new Promise(resolve => setTimeout(resolve, 100))
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  }
}

/**
 * NHN Cloud SMS 발송
 * 문서: https://docs.toast.com/ko/Notification/SMS/ko/api-guide/
 */
async function sendNhnSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  const appKey = process.env.NHN_SMS_APP_KEY
  const secretKey = process.env.NHN_SMS_SECRET_KEY
  const sender = process.env.NHN_SMS_SENDER

  if (!appKey || !secretKey || !sender) {
    logger.error('NHN SMS 설정 누락', { appKey: !!appKey, secretKey: !!secretKey, sender: !!sender })
    return { success: false, error: 'SMS 설정이 완료되지 않았습니다' }
  }

  try {
    const response = await fetch(
      `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${appKey}/sender/sms`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Key': secretKey,
        },
        body: JSON.stringify({
          body: message,
          sendNo: sender.replace(/-/g, ''),
          recipientList: [
            {
              recipientNo: phoneNumber.replace(/-/g, ''),
            },
          ],
        }),
      }
    )

    const data = await response.json()

    if (data.header?.isSuccessful) {
      logger.info('NHN SMS 발송 성공', { phoneNumber, messageId: data.body?.data?.requestId })
      return {
        success: true,
        messageId: data.body?.data?.requestId,
      }
    } else {
      logger.error('NHN SMS 발송 실패', { phoneNumber, error: data.header?.resultMessage })
      return {
        success: false,
        error: data.header?.resultMessage || 'SMS 발송 실패',
      }
    }
  } catch (error) {
    logger.error('NHN SMS 발송 오류', { phoneNumber, error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS 발송 오류',
    }
  }
}

/**
 * Twilio SMS 발송
 * 문서: https://www.twilio.com/docs/sms/api/message-resource
 */
async function sendTwilioSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const sender = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !sender) {
    logger.error('Twilio SMS 설정 누락')
    return { success: false, error: 'SMS 설정이 완료되지 않았습니다' }
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber.startsWith('+') ? phoneNumber : `+82${phoneNumber.replace(/^0/, '')}`,
          From: sender,
          Body: message,
        }),
      }
    )

    const data = await response.json()

    if (data.sid) {
      logger.info('Twilio SMS 발송 성공', { phoneNumber, messageId: data.sid })
      return {
        success: true,
        messageId: data.sid,
      }
    } else {
      logger.error('Twilio SMS 발송 실패', { phoneNumber, error: data.message })
      return {
        success: false,
        error: data.message || 'SMS 발송 실패',
      }
    }
  } catch (error) {
    logger.error('Twilio SMS 발송 오류', { phoneNumber, error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS 발송 오류',
    }
  }
}

/**
 * SMS 발송 (프로바이더 자동 선택)
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  switch (SMS_PROVIDER) {
    case 'nhn':
      return sendNhnSMS(phoneNumber, message)
    case 'twilio':
      return sendTwilioSMS(phoneNumber, message)
    default:
      return sendMockSMS(phoneNumber, message)
  }
}

/**
 * OTP 인증번호 발송
 */
export async function sendOTP(phoneNumber: string, code: string): Promise<SMSResult> {
  const message = `[입주해] 인증번호는 [${code}]입니다. 3분 내에 입력해주세요.`
  return sendSMS(phoneNumber, message)
}

/**
 * 레퍼런스 요청 SMS 발송
 */
export async function sendReferenceRequestSMS(
  landlordPhone: string,
  tenantName: string,
  surveyUrl: string
): Promise<SMSResult> {
  const message = `[입주해] ${tenantName}님이 레퍼런스를 요청했습니다. 아래 링크에서 설문에 응해주세요:\n${surveyUrl}`
  return sendSMS(landlordPhone, message)
}
