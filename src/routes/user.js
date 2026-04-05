const router  = require('express').Router()
const User       = require('../models/User')
const TokoinUser = require('../models/TokoinUser')
const Transaction= require('../models/Transaction')

// GET /api/user/:twitchId
// Perfil completo: dados do viewer + saldo de Tokoins
router.get('/:twitchId', async (req, res) => {
  try {
    const { twitchId } = req.params

    const [user, tokoin] = await Promise.all([
      User.findOne({ userId: twitchId }).lean(),
      TokoinUser.findOne({ twitchId }).lean(),
    ])

    if (!user && !tokoin) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    res.json({
      twitchId,
      displayName:  user?.displayName  ?? tokoin?.username ?? 'Desconhecido',
      isSubscriber: user?.isSubscriber ?? false,
      isVip:        user?.isVip        ?? false,
      isMod:        user?.isMod        ?? false,
      visits:       user?.visits       ?? 0,
      lastSeen:     user?.lastSeen     ?? null,
      firstSeen:    user?.firstSeen    ?? null,
      tags:         user?.tags         ?? [],
      tokoins: {
        balance:     tokoin?.balance     ?? 0,
        totalEarned: tokoin?.totalEarned ?? 0,
        totalSpent:  tokoin?.totalSpent  ?? 0,
      },
    })
  } catch (err) {
    console.error('[GET /user/:id]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// GET /api/user/:twitchId/perks
// Perks ativos — usado pelo overlay e pelo WinPerfil
router.get('/:twitchId/perks', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.twitchId }).lean()
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

    const perks = []
    if (user.isVip)        perks.push({ id: 'vip',        label: 'VIP',        icon: '👑' })
    if (user.isSubscriber) perks.push({ id: 'subscriber', label: 'Inscrito',   icon: '⭐' })
    if (user.isMod)        perks.push({ id: 'mod',        label: 'Moderador',  icon: '🔨' })
    // Futuro: buscar perks comprados na loja aqui

    res.json({ twitchId: req.params.twitchId, perks })
  } catch (err) {
    console.error('[GET /user/:id/perks]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// GET /api/user/:twitchId/transactions?limit=20
// Histórico de Tokoins do usuário
router.get('/:twitchId/transactions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const txs = await Transaction
      .find({ twitchId: req.params.twitchId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    res.json(txs)
  } catch (err) {
    console.error('[GET /user/:id/transactions]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

module.exports = router
