const { Schema, model } = require('mongoose')

const PurchaseSchema = new Schema({
  twitchId:    { type: String, required: true },
  username:    String,
  itemId:      { type: String, required: true },
  itemName:    String,
  purchasedAt: { type: Date, default: Date.now },
  expiresAt:   { type: Date, default: null },  // null = permanente
  active:      { type: Boolean, default: true },
}, { collection: 'loja_purchases', timestamps: false })

PurchaseSchema.index({ twitchId: 1, itemId: 1 })

module.exports = model('Purchase', PurchaseSchema)
