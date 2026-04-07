// routes/jogos.js
const express    = require('express')
const router     = express.Router()
const TokoinUser = require('../models/TokoinUser')

// ── Configuração dos jogos ────────────────────────────────────────────────────
const GAME_CONFIG = {
  caraouCoroa: {
    minBet:      10,
    maxBet:      1000,
    limitNonSub: 5,   // seguidores: 5x por dia
    limitSub:    10,  // inscritos: 10x por dia
    multiplier:  2,
  }
}

// ── Verifica se é seguidor via Twitch API ─────────────────────────────────────
async function isFollower(twitchId) {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${process.env.BROADCASTER_ID}&user_id=${twitchId}`,
      { headers: {
        'Client-Id':     process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
      }}
    )
    const data = await res.json()
    console.log('[isFollower] status:', res.status, 'data:', JSON.stringify(data))
    return (data.total ?? 0) > 0
  } catch (e) {
    console.error('[isFollower] erro:', e.message)
    return false
  }
}

// ── Verifica se é inscrito via Twitch API ─────────────────────────────────────
async function isSubscriber(twitchId) {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${process.env.BROADCASTER_ID}&user_id=${twitchId}`,
      {
        headers: {
          'Client-Id':     process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        }
      }
    )
    return res.status === 200
  } catch {
    return false
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
    // ── Verifica seguidor/inscrito ────────────────────────────────────────────
    const [follower, subscriber] = await Promise.all([
      isFollower(twitchId),
      isSubscriber(twitchId),
    ])

    if (!follower && !subscriber) {
      return res.status(403).json({
        error: 'Você precisa seguir o canal para jogar! Siga @maxterlabs na Twitch.'
      })
    }

    // ── Busca ou cria usuário ─────────────────────────────────────────────────
    let user = await TokoinUser.findOne({ twitchId: String(twitchId) })
    if (!user) {
      user = await TokoinUser.create({
        twitchId: String(twitchId),
        username: req.body.username || twitchId,
        balance:  0,
      })
    }

    if (user.balance < aposta) {
      return res.status(400).json({ error: 'Saldo insuficiente.' })
    }

    // ── Limite diário ─────────────────────────────────────────────────────────
    const limit = subscriber ? config.limitSub : config.limitNonSub
    if (limit !== -1) {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const jogadasHoje = (user.transactions || []).filter(t =>
        t.type === `game_${jogo}` && new Date(t.createdAt) >= hoje
      ).length
      if (jogadasHoje >= limit) {
        return res.status(400).json({
          error: `Limite diário de ${limit} jogadas atingido. Volte amanhã!`
        })
      }
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

    // ── Atualiza saldo e registra transação ───────────────────────────────────
    user.balance     += delta
    user.totalEarned  = ganhou ? user.totalEarned + aposta : user.totalEarned
    user.totalSpent   = !ganhou ? user.totalSpent + aposta : user.totalSpent

    user.transactions.push({
      type:      `game_${jogo}`,
      delta,
      meta:      { jogo, aposta, opcao, resultado, ganhou },
      createdAt: new Date(),
    })

    await user.save()

    res.json({
      resultado,
      ganhou,
      delta,
      newBalance:  user.balance,
      isSubscriber: subscriber,
      isFollower:   follower,
    })

  } catch (e) {
    console.error('[Jogos]', e)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

module.exports = router