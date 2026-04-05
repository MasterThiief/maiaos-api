const Emoji = require('./Emoji')

/**
 * Normaliza o campo subscriber_only → subscriberOnly antes de salvar
 */
function normalize(raw) {
  const e = { ...raw }
  if ('subscriber_only' in e && !('subscriberOnly' in e)) {
    e.subscriberOnly = e.subscriber_only
    delete e.subscriber_only
  }
  return {
    trigger:        e.trigger,
    sound:          e.sound,
    imgUrl:         e.imgUrl ?? null, 
    subscriberOnly: e.subscriberOnly ?? e.subscriber_only ?? false,
    limitNonSub:    e.limitNonSub    ?? -1,
    limitSub:       e.limitSub       ?? -1,
    floatEffect:    e.floatEffect    ?? { enabled: false, count: 6,   size: 60,  duration: 4 },
    confettiEffect: e.confettiEffect ?? { enabled: false, count: 150, duration: 3 },
    enabled:        e.enabled        ?? true,
  }
}

/**
 * Substitui todos os emojis no Atlas preservando timesUsed e lastUsedAt.
 * Recebe o array cru vindo do emojis.json local.
 */
async function syncEmojis(rawArray) {
  if (!Array.isArray(rawArray) || rawArray.length === 0)
    throw new Error('Array de emojis vazio ou inválido.')

  const results = []

  for (const raw of rawArray) {
    const data = normalize(raw)

    const updated = await Emoji.findOneAndUpdate(
      { trigger: data.trigger },
      {
        $set: {
          sound:          data.sound,
		  imgUrl:         data.imgUrl ?? null, 
          subscriberOnly: data.subscriberOnly,
          limitNonSub:    data.limitNonSub,
          limitSub:       data.limitSub,
          floatEffect:    data.floatEffect,
          confettiEffect: data.confettiEffect,
          enabled:        data.enabled,
        },
        // timesUsed e lastUsedAt só são criados na inserção — nunca sobrescritos
        $setOnInsert: {
          timesUsed:  0,
          lastUsedAt: null,
        },
      },
      { upsert: true, new: true }
    )
    results.push(updated.trigger)
  }

  return results
}

/**
 * Lista todos os emojis ativos (opcionalmente filtra subscriber-only).
 */
async function listEmojis({ onlyFree = false } = {}) {
  const query = { enabled: true }
  if (onlyFree) query.subscriberOnly = false
  return Emoji.find(query).sort({ timesUsed: -1 }).lean()
}

/**
 * Incrementa timesUsed + atualiza lastUsedAt de um trigger.
 * Chamado pelo index.ts do backend da Maia quando o emote dispara no chat.
 */
async function incrementUsage(trigger) {
  return Emoji.findOneAndUpdate(
    { trigger },
    { $inc: { timesUsed: 1 }, $set: { lastUsedAt: new Date() } }
  )
}

module.exports = { syncEmojis, listEmojis, incrementUsage }
