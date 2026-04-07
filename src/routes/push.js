const express  = require('express')
const router   = express.Router()
const webpush  = require('web-push')
const PushSub  = require('../models/PushSubscription')

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
)

// ── POST /api/push/subscribe ──────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { subscription, twitchId } = req.body
  if (!subscription) return res.status(400).json({ error: 'subscription obrigatória' })

  try {
    // Atualiza se já existe, cria se não existe
    await PushSub.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      { subscription, twitchId: twitchId || null },
      { upsert: true, new: true }
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('[Push] subscribe error:', e)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/push/unsubscribe ────────────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório' })
  await PushSub.deleteOne({ 'subscription.endpoint': endpoint })
  res.json({ ok: true })
})

// ── Função interna — dispara push para todos os inscritos ─────────────────────
async function notifyAll(payload) {
  const subs = await PushSub.find({})
  const results = await Promise.allSettled(
    subs.map(doc =>
      webpush.sendNotification(doc.subscription, JSON.stringify(payload))
        .catch(async (err) => {
          // Remove subscriptions inválidas/expiradas automaticamente
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSub.deleteOne({ _id: doc._id })
          }
        })
    )
  )
  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  console.log(`[Push] enviado: ${sent} | falhou: ${failed}`)
  return { sent, failed }
}

// ── POST /api/push/test — dispara push de teste ───────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const result = await notifyAll({
      title: '📺 Teste — O Maxter está ao vivo!',
      body:  'Isso é um teste de notificação. A live começou!',
      url:   'https://maxterlabs.pages.dev',
      icon:  '/logo-maiaos.png',
    })
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('[Push/test]', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = { router, notifyAll }