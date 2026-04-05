const { Schema, model } = require('mongoose')

const TokoinUserSchema = new Schema({
  twitchId:    { type: String, required: true, unique: true },
  username:    String,
  balance:     { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalSpent:  { type: Number, default: 0 },
}, { collection: 'tokoins_users', timestamps: true })

module.exports = model('TokoinUser', TokoinUserSchema)
