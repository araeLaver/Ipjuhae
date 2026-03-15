const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server: SocketIOServer } = require('socket.io')
const jwt = require('jsonwebtoken')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다')
    }
    return 'dev-only-secret-do-not-use-in-production'
  }
  return secret
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    path: '/api/ws',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // API routes에서 접근 가능하도록 global에 저장
  globalThis.io = io

  // JWT 인증 미들웨어
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('인증이 필요합니다'))
    }
    try {
      const payload = jwt.verify(token, getJwtSecret())
      socket.data.userId = payload.userId
      socket.data.userType = payload.userType
      next()
    } catch {
      next(new Error('유효하지 않은 토큰입니다'))
    }
  })

  io.on('connection', (socket) => {
    // 대화방 참여
    socket.on('join', (conversationId) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`)
    })

    // 타이핑 인디케이터
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId: socket.data.userId,
      })
    })

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId: socket.data.userId,
      })
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
