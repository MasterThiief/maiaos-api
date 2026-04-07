// models/TokoinUser.js
const { Schema, model } = require('mongoose')

const TransactionSchema = new Schema({
  type:      { type: String, required: true },
  delta:     { type: Number, required: true },
  meta:      { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const TokoinUserSchema = new Schema({
  twitchId:     { type: String, required: true, unique: true },
  username:     String,
  balance:      { type: Number, default: 0 },
  totalEarned:  { type: Number, default: 0 },
  totalSpent:   { type: Number, default: 0 },
  transactions: { type: [TransactionSchema], default: [] },
}, { collection: 'tokoins_users', timestamps: true })

module.exports = model('TokoinUser', TokoinUserSchema)