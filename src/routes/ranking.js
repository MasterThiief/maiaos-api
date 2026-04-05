const router     = require('express').Router()
const TokoinUser = require('../models/TokoinUser')
const User       = require('../models/User')

// GET /api/ranking?limit=10
// Top viewers por saldo de Tokoins
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)

    const top = await TokoinUser
      .find({ balance: { $gt: 0 } })
      .sort({ balance: -1 })
      .limit(limit)
      .lean()

    // Enriquecer com dados de visits do users (join manual — MongoDB não tem JOIN)
    const ids  = top.map(t => t.twitchId)
    const users = await User.find({ userId: { $in: ids } }).lean()
    const userMap = Object.fromEntries(users.map(u => [u.userId, u]))

    const ranked = top.map((t, i) => ({
      position:    i + 1,
      twitchId:    t.twitchId,
      displayName: userMap[t.twitchId]?.displayName ?? t.username,
      balance:     t.balance,
      totalEarned: t.totalEarned,
      visits:      userMap[t.twitchId]?.visits ?? 0,
      isSubscriber:userMap[t.twitchId]?.isSubscriber ?? false,
      isVip:       userMap[t.twitchId]?.isVip ?? false,
    }))

    res.json(ranked)
  } catch (err) {
    console.error('[GET /ranking]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

module.exports = router
