// routes/jogos.js
const express = require('express')
const router  = express.Router()
const User    = require('../models/User')

// ── Configuração dos jogos ────────────────────────────────────────────────────
const GAME_CONFIG = {
  caraouCoroa: {
    minBet:       10,    // aposta mínima em Tokoins
    maxBet:       1000,  // aposta máxima em Tokoins
    limitNonSub:  -1,    // -1 = ilimitado
    limitSub:     -1,    // -1 = ilimitado
    multiplier:   2,     // ganho = aposta * multiplier
  }
}

// ── POST /api/jogos/jogar ─────────────────────────────────────────────────────
router.post('/jogar', async (req, res) => {
  const { twitchId, jogo, aposta, opcao } = req.body

  // Validação básica
  if (!twitchId || !jogo || !aposta || !opcao) {
    return res.status(400).json({ error: 'Dados incompletos.' })
  }

  const config = GAME_CONFIG[jogo]
  if (!config) {
    return res.status(400).json({ error: `Jogo "${jogo}" não encontrado.` })
  }

  if (aposta < config.minBet || aposta > config.maxBet) {
    return res.status(400).json({
      error: `Aposta deve ser entre ${config.minBet} e ${config.maxBet} Tokoins.`
    })
  }

  try {
    const user = await User.findOne({ twitchId })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })

    // Valida saldo
    if (user.tokoins.balance < aposta) {
      return res.status(400).json({ error: 'Saldo insuficiente.' })
    }

    // ── Limite diário (desativado por enquanto — -1 = ilimitado) ────────────
    if (config.limitNonSub !== -1 || config.limitSub !== -1) {
      const limit = user.isSubscriber ? config.limitSub : config.limitNonSub
      if (limit !== -1) {
        const today     = new Date()
        today.setHours(0, 0, 0, 0)
        const playedToday = (user.tokoins.transactions || []).filter(t =>
          t.type === `game_${jogo}` && new Date(t.createdAt) >= today
        ).length
        if (playedToday >= limit) {
          return res.status(400).json({
            error: `Limite diário de ${limit} jogadas atingido.`
          })
        }
      }
    }

    // ── Lógica do jogo — roda no servidor ────────────────────────────────────
    let resultado = null
    let ganhou    = false
    let delta     = 0

    if (jogo === 'caraouCoroa') {
      const opcoes   = ['cara', 'coroa']
      resultado      = opcoes[Math.floor(Math.random() * 2)]
      ganhou         = resultado === opcao
      delta          = ganhou ? aposta * (config.multiplier - 1) : -aposta
    }

    // ── Atualiza saldo e registra transação ───────────────────────────────────
    user.tokoins.balance    += delta
    user.tokoins.totalEarned = ganhou
      ? (user.tokoins.totalEarned || 0) + aposta
      : user.tokoins.totalEarned
    user.tokoins.totalSpent  = !ganhou
      ? (user.tokoins.totalSpent || 0) + aposta
      : user.tokoins.totalSpent

    user.tokoins.transactions = user.tokoins.transactions || []
    user.tokoins.transactions.push({
      type:      `game_${jogo}`,
      delta,
      balance:   user.tokoins.balance,
      meta:      { jogo, aposta, opcao, resultado, ganhou },
      createdAt: new Date(),
    })

    await user.save()

    res.json({
      resultado,
      ganhou,
      delta,
      newBalance: user.tokoins.balance,
    })

  } catch (e) {
    console.error('[Jogos]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

module.exports = router