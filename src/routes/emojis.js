const express = require('express')
const router  = express.Router()
const { syncEmojis, listEmojis, incrementUsage } = require('../models/emojiService')

// GET /api/emojis
// Query: ?onlyFree=true  →  filtra subscriber-only
router.get('/', async (req, res) => {
  try {
    const onlyFree = req.query.onlyFree === 'true'
    const emojis = await listEmojis({ onlyFree })
    res.json(emojis)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/emojis/sync
// Body: array de emojis vindo do emojis.json local (AdminView)
router.post('/sync', async (req, res) => {
  try {
    const raw = req.body
    if (!Array.isArray(raw)) return res.status(400).json({ error: 'Body deve ser um array.' })
    const saved = await syncEmojis(raw)
    res.json({ ok: true, synced: saved.length, triggers: saved })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/emojis/:trigger/use
// Chamado pelo index.ts da Maia quando um emote dispara no chat
router.post('/:trigger/use', async (req, res) => {
  try {
    await incrementUsage(req.params.trigger)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
