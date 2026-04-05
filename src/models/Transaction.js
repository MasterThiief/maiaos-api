const { Schema, model } = require('mongoose')

const TransactionSchema = new Schema({
  twitchId:    { type: String, required: true },
  username:    String,
  amount:      Number,
  balanceAfter:Number,
  type:        String,  // earn_channel_points, spend_loja, etc.
  description: String,
  metadata:    Schema.Types.Mixed,
}, { collection: 'tokoins_transactions', timestamps: true })

// Índice para buscas por usuário ordenadas por data
TransactionSchema.index({ twitchId: 1, createdAt: -1 })

module.exports = model('Transaction', TransactionSchema)
