const express   = require('express')
const router    = express.Router()
const crypto    = require('crypto')
const { notifyAll } = require('./push')

const TWITCH_MESSAGE_ID           = 'twitch-eventsub-message-id'
const TWITCH_MESSAGE_TIMESTAMP    = 'twitch-eventsub-message-timestamp'
const TWITCH_MESSAGE_SIGNATURE    = 'twitch-eventsub-message-signature'
const TWITCH_MESSAGE_TYPE         = 'twitch-eventsub-message-type'
const MESSAGE_TYPE_VERIFICATION   = 'webhook_callback_verification'
const MESSAGE_TYPE_NOTIFICATION   = 'notification'
const MESSAGE_TYPE_REVOCATION     = 'revocation'

function verifySignature(req) {
  const messageId        = req.headers[TWITCH_MESSAGE_ID]
  const messageTimestamp = req.headers[TWITCH_MESSAGE_TIMESTAMP]
  const messageSignature = req.headers[TWITCH_MESSAGE_SIGNATURE]
  const body             = req.rawBody // precisa do rawBody

  const hmacMessage = messageId + messageTimestamp + body
  const hmac = 'sha256=' + crypto
    .createHmac('sha256', process.env.TWITCH_WEBHOOK_SECRET)
    .update(hmacMessage)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(messageSignature)
  )
}

// ── POST /api/eventsub ────────────────────────────────────────────────────────
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  // Salva rawBody para verificação
  req.rawBody = req.body.toString()
  let body
  try { body = JSON.parse(req.rawBody) } catch { return res.sendStatus(400) }

  // Verifica assinatura
  if (!verifySignature(req)) {
    console.warn('[EventSub] assinatura inválida')
    return res.sendStatus(403)
  }

  const messageType = req.headers[TWITCH_MESSAGE_TYPE]

  // Verificação inicial do webhook (Twitch exige resposta com challenge)
  if (messageType === MESSAGE_TYPE_VERIFICATION) {
    console.log('[EventSub] webhook verificado pela Twitch ✅')
    return res.status(200).send(body.challenge)
  }

  if (messageType === MESSAGE_TYPE_REVOCATION) {
    console.warn('[EventSub] subscription revogada:', body.subscription.type)
    return res.sendStatus(204)
  }

  if (messageType === MESSAGE_TYPE_NOTIFICATION) {
    const { type } = body.subscription
    const event    = body.event

    if (type === 'stream.online') {
      console.log('[EventSub] stream.online — disparando push')
      notifyAll({
        title: '📺 O Maxter está ao vivo!',
        body:  event.type === 'live' ? 'A live começou! Clique para assistir.' : 'Stream iniciada!',
        url:   'https://maxterlabs.pages.dev',
        icon:  '/logo-maiaos.png',
      }).catch(console.error)
    }

    return res.sendStatus(204)
  }

  res.sendStatus(204)
})

module.exports = router