const { Schema, model } = require('mongoose')

const EmojiSchema = new Schema({
  trigger:        { type: String,  required: true, unique: true },
  sound:          { type: String,  required: true },
  subscriberOnly: { type: Boolean, default: false },
  limitNonSub:    { type: Number,  default: -1 },
  limitSub:       { type: Number,  default: -1 },
  floatEffect: {
    enabled:  { type: Boolean, default: false },
    count:    { type: Number,  default: 6 },
    size:     { type: Number,  default: 60 },
    duration: { type: Number,  default: 4 },
  },
  confettiEffect: {
    enabled:  { type: Boolean, default: false },
    count:    { type: Number,  default: 150 },
    duration: { type: Number,  default: 3 },
  },
  imgUrl:     { type: String,  default: null },
  enabled:    { type: Boolean, default: true },
  timesUsed:  { type: Number,  default: 0 },
  lastUsedAt: { type: Date,    default: null },
}, { collection: 'emojis', timestamps: false })

module.exports = model('Emoji', EmojiSchema)
