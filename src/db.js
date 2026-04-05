const mongoose = require('mongoose')

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB, // ← aqui
    })
    console.log(`[DB] Conectado ao Atlas — banco: ${process.env.MONGODB_DB}`)
  } catch (err) {
    console.error('[DB] Erro ao conectar:', err.message)
    process.exit(1)
  }
}

module.exports = connectDB