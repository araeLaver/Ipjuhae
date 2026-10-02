const { createServer } = require('http')
const path = require('path')
const { Server: SocketIOServer } = require('socket.io')
const { verifySocketToken, socketMembershipAllowed } = require('./socket-auth')

const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '8000', 10)
const dev = process.env.NODE_ENV !== 'production'

async function start() {
  let handler

  if (!dev) {
    // Production: Set standalone config so Next.js serves _next/static/* and _next/image/*
    const conf = require('./.next/required-server-files.json')
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(conf.config)

    const next = require('next')
    const app = next({
      dev: false,
      hostname,
      port,
      dir: path.join(__dirname),
      conf: conf.config,
    })
    await app.prepare()
    handler = app.getRequestHandler()
  } else {
    // Development: Use next() API with hot reload
    const next = require('next')
    const app = next({ dev: true, hostname, port })
    await app.prepare()
    handler = app.getRequestHandler()
  }

  const httpServer = createServer((req, res) => {
    handler(req, res)
  })

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
  if (!configuredOrigin) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for Socket.IO origin checks')
  }
  const appUrl = new URL(configuredOrigin)
  const localOrigin = ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)
  if (appUrl.protocol !== 'https:' && !(localOrigin && appUrl.protocol === 'http:')) {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS outside local development')
  }
  if (appUrl.username || appUrl.password) {
    throw new Error('NEXT_PUBLIC_APP_URL must not include credentials')
  }
  const appOrigin = appUrl.origin

  const io = new SocketIOServer(httpServer, {
    path: '/api/ws',
    addTrailingSlash: false,
    cors: {
      origin: appOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // API routes에서 접근 가능하도록 global에 저장
  globalThis.io = io

  const { Pool } = require('pg')
  const { resolveDbSsl } = await import('./lib/db-ssl.mjs')
  const dbSchema = process.env.DB_SCHEMA || 'ipjuhae'
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbSchema)) throw new Error('Invalid DB_SCHEMA')
  const socketDb = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: resolveDbSsl(process.env.DATABASE_URL, { rejectUnauthorized: !dev }),
    options: `-c search_path=${dbSchema},public`, max: 5, connectionTimeoutMillis: 5000 })

  // 짧은 수명의 대화방 범위 토큰만 허용한다.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    const claims = verifySocketToken(token)
    if (!claims) {
      return next(new Error('Invalid socket token'))
    }

    try {
      if (!await socketMembershipAllowed(socketDb, claims)) return next(new Error('Conversation not available'))
    } catch { return next(new Error('Conversation not available')) }
    socket.data.userId = claims.userId
    socket.data.conversationId = claims.conversationId
    socket.data.expiresAt = claims.expiresAt
    next()
  })

  io.on('connection', (socket) => {
    const scopedConversationId = socket.data.conversationId
    const scopedRoom = `conversation:${scopedConversationId}`
    socket.join(scopedRoom)
    const tokenExpiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now())
    )
    tokenExpiryTimer.unref?.()

    socket.on('disconnect', () => clearTimeout(tokenExpiryTimer))

    socket.on('join', (conversationId) => {
      if (conversationId === scopedConversationId) {
        socket.join(scopedRoom)
      }
    })

    socket.on('leave', (conversationId) => {
      if (conversationId === scopedConversationId) {
        socket.leave(scopedRoom)
      }
    })

    socket.on('typing:start', (conversationId) => {
      if (conversationId !== scopedConversationId) return
      socket.to(scopedRoom).emit('typing:start', {
        userId: socket.data.userId,
      })
    })

    socket.on('typing:stop', (conversationId) => {
      if (conversationId !== scopedConversationId) return
      socket.to(scopedRoom).emit('typing:stop', {
        userId: socket.data.userId,
      })
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
