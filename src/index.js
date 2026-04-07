require('dotenv').config()

const express    = require('express')
const cors       = require('cors')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { StaticAuthProvider } = require('@twurple/auth')
const { ChatClient }         = require('@twurple/chat')
const connectDB  = require('./db')

const userRoutes    = require('./routes/user')
const rankingRoutes = require('./routes/ranking')
const lojaRoutes    = require('./routes/loja')
const emojiRoutes   = require('./routes/emojis')
const jogosRoutes = require('./routes/jogos')

const app        = express()
const httpServer = createServer(app)
const PORT       = process.env.PORT || 3001

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:  process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  }
})

// ── Cache de avatares em memória (limpa a cada 6h) ───────────────────────────
const avatarCache = new Map()
setInterval(() => avatarCache.clear(), 6 * 60 * 60 * 1000)

// ── Twitch IRC — só leitura do chat ─────────────────────────────────────────
const authProvider = new StaticAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_ACCESS_TOKEN
)
const chatClient = new ChatClient({ authProvider, channels: ['maxterlabs'] })

chatClient.onMessage(async (channel, userName, text, msg) => {
  const userId = msg.userInfo.userId
  let avatarUrl = avatarCache.get(userId) ?? ''

  if (!avatarUrl) {
    try {
      const res  = await fetch(
        `https://api.twitch.tv/helix/users?id=${userId}`,
        { headers: {
            'Client-Id':     process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        }}
      )
      const data = await res.json()
      avatarUrl  = data.data?.[0]?.profile_image_url ?? ''
      if (avatarUrl) avatarCache.set(userId, avatarUrl)
    } catch { /* silencioso */ }
  }

  // Serializa emoteOffsets:{ emoteId -> [posições] }
  const emotes = {}
  if (msg.emoteOffsets?.size) {
    for (const [emoteId, positions] of msg.emoteOffsets) {
      emotes[emoteId] = positions // ex: { '425618': [[0,2], [10,12]] }
    }
  }

  io.emit('chat-message', {
    id:       msg.id,
    username: msg.userInfo.displayName,
    message:  text,
    color:    msg.userInfo.color || null,
    isMod:    msg.userInfo.isMod,
    isSub:    msg.userInfo.isSubscriber,
    avatarUrl,
    emotes,   // [NOVO]
  })
})

chatClient.onConnect(() => console.log('[MaiaOS API] Twitch IRC conectado'))
chatClient.onDisconnect((manually, reason) => {
  if (!manually) console.warn('[MaiaOS API] Twitch IRC desconectado:', reason?.message ?? '')
})
chatClient.connect()

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors({
  origin:  process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'maiaos-api', ts: new Date().toISOString() })
})

// ── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/user',    userRoutes)
app.use('/api/ranking', rankingRoutes)
app.use('/api/loja',    lojaRoutes)
app.use('/api/emojis',  emojiRoutes)
app.use('/api/jogos', jogosRoutes)

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
})

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  httpServer.listen(PORT, () => {  // era app.listen — agora é httpServer.listen
    console.log(`[MaiaOS API] Rodando em http://localhost:${PORT}`)
    console.log(`  GET  /health`)
    console.log(`  GET  /api/user/:twitchId`)
    console.log(`  GET  /api/user/:twitchId/perks`)
    console.log(`  GET  /api/user/:twitchId/transactions`)
    console.log(`  GET  /api/ranking`)
    console.log(`  GET  /api/loja/items`)
    console.log(`  POST /api/loja/comprar`)
    console.log(`  POST /api/jogos/jogar`)
  })
})