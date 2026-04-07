const { Schema, model } = require('mongoose')

const PushSubscriptionSchema = new Schema({
  twitchId:     { type: String, default: null },
  subscription: { type: Schema.Types.Mixed, required: true },
  createdAt:    { type: Date, default: Date.now },
}, { collection: 'push_subscriptions' })

module.exports = model('PushSubscription', PushSubscriptionSchema)