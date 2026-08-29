import crypto from 'crypto'
import { getJwtSecret } from './jwt'

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000))
}

// DB 유출 시 오프라인 브루트포스(10^6)를 막기 위해 서버 시크릿으로 키드 해시.
export function hashOtpCode(phoneNumber: string, code: string): string {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${phoneNumber}:${code}`)
    .digest('hex')
}
