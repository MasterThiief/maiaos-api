const router      = require('express').Router()
const User        = require('../models/User')
const TokoinUser  = require('../models/TokoinUser')
const Transaction = require('../models/Transaction')
const RedeemCode  = require('../models/RedeemCode')

const BROADCASTER_ID = process.env.BROADCASTER_ID
const SUB_MULTIPLIER = 1.5

// ── Middleware: verifica se é o root (broadcaster) ────────────────────────────
function requireRoot(req, res, next) {
  const { twitchId } = req.body
  if (!twitchId || twitchId !== BROADCASTER_ID) {
    return res.status(403).json({ error: 'Acesso negado — apenas o root pode executar este comando' })
  }
  next()
}

// Body: { twitchId }
// ── POST /api/cmd/visit ───────────────────────────────────────────────────────
router.post('/visit', async (req, res) => {
  const { twitchId } = req.body
  if (!twitchId) return res.status(400).json({ error: 'twitchId obrigatório' })

  try {
    const user = await User.findOne({ userId: twitchId })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

    const now  = new Date()
    const last = user.lastTerminalVisit

    const visitedToday = last &&
      last.getDate()     === now.getDate()     &&
      last.getMonth()    === now.getMonth()    &&
      last.getFullYear() === now.getFullYear()

    if (!visitedToday) {
      user.terminalVisits   += 1
      user.lastTerminalVisit = now
      await user.save()
    }

    res.json({ visits: user.terminalVisits })
  } catch (err) {
    console.error('[POST /cmd/visit]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/cmd/redeem ──────────────────────────────────────────────────────
// Body: { twitchId, code }
router.post('/redeem', async (req, res) => {
  try {
    const { twitchId, code } = req.body
    if (!twitchId || !code) {
      return res.status(400).json({ error: 'twitchId e code são obrigatórios' })
    }

    const [user, tokoinUser, redeemCode] = await Promise.all([
      User.findOne({ userId: twitchId }).lean(),
      TokoinUser.findOne({ twitchId }),
      RedeemCode.findOne({ code: code.toUpperCase().trim() }),
    ])

    if (!redeemCode || !redeemCode.active) {
      return res.status(404).json({ error: 'Código inválido ou inativo' })
    }
    if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Este código expirou' })
    }
    if (redeemCode.usedBy.includes(twitchId)) {
      return res.status(409).json({ error: 'Você já usou este código' })
    }
    if (redeemCode.usedBy.length >= redeemCode.maxUses) {
      return res.status(410).json({ error: 'Este código já atingiu o limite de usos' })
    }

    const isSub = user?.isSubscriber ?? false
    const multiplier = isSub ? SUB_MULTIPLIER : 1
    const earned = Math.round(redeemCode.value * multiplier)
    const username = user?.displayName ?? twitchId

    let tokoin = tokoinUser
    if (!tokoin) {
      tokoin = new TokoinUser({
        twitchId,
        username,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
      })
    }

    tokoin.balance += earned
    tokoin.totalEarned += earned

    const tx = new Transaction({
      twitchId,
      username,
      amount: earned,
      balanceAfter: tokoin.balance,
      type: 'earn_redeem',
      description: `Redeem código ${redeemCode.code}${isSub ? ' (bônus sub 1.5x)' : ''}`,
      metadata: {
        code: redeemCode.code,
        baseValue: redeemCode.value,
        multiplier,
      },
    })

    redeemCode.usedBy.push(twitchId)
    if (redeemCode.usedBy.length >= redeemCode.maxUses) {
      redeemCode.active = false
    }

    await Promise.all([tokoin.save(), tx.save(), redeemCode.save()])

    return res.json({
      success: true,
      code: redeemCode.code,
      earned,
      multiplier,
      isSub,
      newBalance: tokoin.balance,
    })
  } catch (err) {
    console.error('[POST /cmd/redeem]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/cmd/setcode ─────────────────────────────────────────────────────
// Body: { twitchId, code, value, maxUses?, expiresIn? }
router.post('/setcode', requireRoot, async (req, res) => {
  try {
    const { twitchId, code, value, maxUses = 1, expiresIn = null } = req.body

    if (!code || !value) {
      return res.status(400).json({ error: 'code e value são obrigatórios' })
    }
    if (typeof value !== 'number' || value < 1) {
      return res.status(400).json({ error: 'value deve ser um número positivo' })
    }

    const normalizedCode = code.toUpperCase().trim()

    const existing = await RedeemCode.findOne({ code: normalizedCode })
    if (existing) {
      existing.value = value
      existing.maxUses = maxUses
      existing.usedBy = []
      existing.active = true
      existing.createdBy = twitchId
      existing.expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 1000) : null
      await existing.save()
      return res.json({ success: true, action: 'updated', code: existing })
    }

    const redeemCode = new RedeemCode({
      code: normalizedCode,
      value,
      maxUses,
      createdBy: twitchId,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 60 * 1000) : null,
    })

    await redeemCode.save()
    return res.json({ success: true, action: 'created', code: redeemCode })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Já existe um código com este nome' })
    }
    console.error('[POST /cmd/setcode]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/cmd/revoke ──────────────────────────────────────────────────────
// Body: { twitchId, code }
router.post('/revoke', requireRoot, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'code é obrigatório' })

    const redeemCode = await RedeemCode.findOne({ code: code.toUpperCase().trim() })
    if (!redeemCode) return res.status(404).json({ error: 'Código não encontrado' })

    redeemCode.active = false
    await redeemCode.save()
    return res.json({ success: true, code: redeemCode.code })
  } catch (err) {
    console.error('[POST /cmd/revoke]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

module.exports = router