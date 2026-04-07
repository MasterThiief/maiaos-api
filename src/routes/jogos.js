// routes/jogos.js
const express     = require('express')
const router      = express.Router()
const TokoinUser  = require('../models/TokoinUser')

// ── Configuração dos jogos ────────────────────────────────────────────────────
const GAME_CONFIG = {
  caraouCoroa: {
    minBet:      10,
    maxBet:      1000,
    limitNonSub: -1,
    limitSub:    -1,
    multiplier:  2,
  }
}

// ── POST /api/jogos/jogar ─────────────────────────────────────────────────────
router.post('/jogar', async (req, res) => {
  const { twitchId, jogo, aposta, opcao } = req.body

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
    const user = await TokoinUser.findOne({ twitchId: String(twitchId) })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })

    if (user.balance < aposta) {
      return res.status(400).json({ error: 'Saldo insuficiente.' })
    }

    // ── Lógica do jogo ────────────────────────────────────────────────────────
    let resultado = null
    let ganhou    = false
    let delta     = 0

    if (jogo === 'caraouCoroa') {
      const opcoes = ['cara', 'coroa']
      resultado    = opcoes[Math.floor(Math.random() * 2)]
      ganhou       = resultado === opcao
      delta        = ganhou ? aposta * (config.multiplier - 1) : -aposta
    }

    // ── Atualiza saldo ────────────────────────────────────────────────────────
    user.balance     += delta
    user.totalEarned  = ganhou ? user.totalEarned + aposta : user.totalEarned
    user.totalSpent   = !ganhou ? user.totalSpent + aposta : user.totalSpent

    await user.save()

    res.json({
      resultado,
      ganhou,
      delta,
      newBalance: user.balance,
    })

  } catch (e) {
    console.error('[Jogos]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

module.exports = router