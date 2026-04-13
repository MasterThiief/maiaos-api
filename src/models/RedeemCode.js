const mongoose = require('mongoose')

const RedeemCodeSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, uppercase: true, trim: true },
  value:     { type: Number, required: true, min: 1 },      // valor base em Tokoins
  maxUses:   { type: Number, default: 1, min: 1 },          // quantas vezes pode ser usado
  usedBy:    [{ type: String }],                            // twitchIds que já usaram
  expiresAt: { type: Date, default: null },                  // null = sem expiração
  createdBy: { type: String, required: true },              // twitchId do root
  active:    { type: Boolean, default: true },
}, { timestamps: true })

// Index pra lookup rápido por código
RedeemCodeSchema.index({ code: 1 })

// Virtual: quantos usos restam
RedeemCodeSchema.virtual('usesLeft').get(function () {
  return this.maxUses - this.usedBy.length
})

module.exports = mongoose.model('RedeemCode', RedeemCodeSchema)
