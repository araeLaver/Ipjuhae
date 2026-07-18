export interface SocketTokenInput {
  userId: string
  conversationId: string
}

export interface SocketTokenClaims extends SocketTokenInput {
  expiresAt: number
}

export const SOCKET_TOKEN_AUDIENCE: string
export const SOCKET_TOKEN_ISSUER: string
export const SOCKET_TOKEN_TTL_SECONDS: number

export function createSocketToken(input: SocketTokenInput): string
export function verifySocketToken(token: string): SocketTokenClaims | null
