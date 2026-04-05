const router     = require('express').Router()
const TokoinUser = require('../models/TokoinUser')
const Transaction= require('../models/Transaction')
const Purchase   = require('../models/Purchase')

// Catálogo — renewable: false = permanente | duration = dias do perk
const ITEMS = [
  { id: 'tema-galaxia',  name: 'Tema Galáxia',     price: 500,  icon: '🌌', category: 'tema',  desc: 'Wallpaper nebulosa animada', renewable: false, duration: null },
  { id: 'tema-natureza', name: 'Tema Natureza',     price: 300,  icon: '🌿', category: 'tema',  desc: 'Desktop verde e relaxante',  renewable: false, duration: null },
  { id: 'tema-inferno',  name: 'Tema Inferno',      price: 750,  icon: '🔥', category: 'tema',  desc: 'Wallpaper de lava e fogo',   renewable: false, duration: null },
  { id: 'perk-alerta',   name: 'Alerta de Chegada', price: 1200, icon: '🔔', category: 'perk',  desc: 'Alerta especial na live por 30 dias', renewable: true, duration: 30 },
  { id: 'icone-vip',     name: 'Ícone VIP',         price: 400,  icon: '👑', category: 'icone', desc: 'Coroa dourada no perfil',    renewable: false, duration: null },
  { id: 'icone-maia',    name: 'Avatar Maia',        price: 600,  icon: '🤖', category: 'icone', desc: 'Foto da Maia no perfil',     renewable: false, duration: null },
]

// GET /api/loja/items?twitchId=xxx
// Retorna itens com campo `owned` e `expiresAt` se o usuário for informado
router.get('/items', async (req, res) => {
  const { twitchId } = req.query
  let ownedMap = {}

  if (twitchId) {
    const purchases = await Purchase.find({ twitchId, active: true }).lean()
    const now = new Date()
    purchases.forEach(p => {
      const valid = !p.expiresAt || p.expiresAt > now
      if (valid) ownedMap[p.itemId] = p.expiresAt || true
    })
  }

  const enriched = ITEMS.map(item => ({
    ...item,
    owned:     !!ownedMap[item.id],
    expiresAt: ownedMap[item.id] instanceof Date ? ownedMap[item.id] : null,
  }))

  res.json(enriched)
})

// GET /api/loja/owned/:twitchId
// Lista completa de itens ativos do usuário
router.get('/owned/:twitchId', async (req, res) => {
  try {
    const now = new Date()
    const purchases = await Purchase.find({
      twitchId: req.params.twitchId,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean()
    res.json(purchases)
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/loja/comprar
// Body: { twitchId, itemId }
router.post('/comprar', async (req, res) => {
  const { twitchId, itemId } = req.body
  if (!twitchId || !itemId)
    return res.status(400).json({ error: 'twitchId e itemId são obrigatórios' })

  const item = ITEMS.find(i => i.id === itemId)
  if (!item) return res.status(404).json({ error: 'Item não encontrado' })

  try {
    const now      = new Date()
    const existing = await Purchase.findOne({ twitchId, itemId, active: true })

    if (existing) {
      if (!item.renewable) {
        return res.status(409).json({ error: 'Você já possui este item' })
      }
      // Perk renovável: bloqueia se ainda não expirou
      if (existing.expiresAt && existing.expiresAt > now) {
        const days = Math.ceil((existing.expiresAt - now) / (1000 * 60 * 60 * 24))
        return res.status(409).json({
          error:     `Perk ainda ativo por mais ${days} dia(s)`,
          expiresAt: existing.expiresAt,
        })
      }
      // Expirou — desativa o antigo
      existing.active = false
      await existing.save()
    }

    // Validar saldo
    const tokoin = await TokoinUser.findOne({ twitchId })
    if (!tokoin)           return res.status(404).json({ error: 'Usuário não encontrado' })
    if (tokoin.balance < item.price)
      return res.status(402).json({
        error:   'Saldo insuficiente',
        balance: tokoin.balance,
        price:   item.price,
        falta:   item.price - tokoin.balance,
      })

    // Debitar saldo de forma atômica
    tokoin.balance    -= item.price
    tokoin.totalSpent += item.price
    await tokoin.save()

    // Criar registro de compra
    const expiresAt = item.duration
      ? new Date(now.getTime() + item.duration * 24 * 60 * 60 * 1000)
      : null

    await Purchase.create({
      twitchId,
      username:  tokoin.username,
      itemId:    item.id,
      itemName:  item.name,
      expiresAt,
      active:    true,
    })

    // Registrar transação
    await Transaction.create({
      twitchId,
      username:     tokoin.username,
      amount:       -item.price,
      balanceAfter: tokoin.balance,
      type:         'spend_loja',
      description:  `Compra: ${item.name}`,
      metadata:     { itemId: item.id, itemName: item.name, expiresAt },
    })

    res.json({
      success:    true,
      item:       item.name,
      newBalance: tokoin.balance,
      expiresAt,
    })
  } catch (err) {
    console.error('[POST /loja/comprar]', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

module.exports = router
