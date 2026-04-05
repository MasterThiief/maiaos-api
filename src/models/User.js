const { Schema, model } = require('mongoose')

const UserSchema = new Schema({
  userId:           { type: String, required: true, unique: true }, // twitchId
  displayName:      String,
  isSubscriber:     { type: Boolean, default: false },
  isVip:            { type: Boolean, default: false },
  isMod:            { type: Boolean, default: false },
  visits:           { type: Number,  default: 0 },
  lastSeen:         Date,
  firstSeen:        Date,
  tags:             [String],
  memorableMessages:[String],
  insideJokes:      [String],
}, { collection: 'users', timestamps: false })

module.exports = model('User', UserSchema)
