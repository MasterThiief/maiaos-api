# MaiaOS API

Backend BFF (Backend for Frontend) do MaiaOS.
Ponte entre o MongoDB Atlas e o site Vue.js.

## Setup local

```bash
npm install
cp .env.example .env
# Edite .env com sua URI do MongoDB Atlas
npm run dev
```

## Rotas disponíveis

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/user/:twitchId` | Perfil completo + Tokoins |
| GET | `/api/user/:twitchId/perks` | Perks ativos |
| GET | `/api/user/:twitchId/transactions` | Histórico de Tokoins |
| GET | `/api/ranking?limit=10` | Top viewers |
| GET | `/api/loja/items` | Itens da loja |
| POST | `/api/loja/comprar` | Comprar item `{ twitchId, itemId }` |

## Deploy no Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. Conecte este repositório
4. Em **Variables**, adicione as mesmas variáveis do `.env.example`
   - `MONGODB_URI` → sua URI do Atlas
   - `CORS_ORIGIN` → URL do MaiaOS no ar (ex: `https://maiaos.vercel.app`)
5. Railway detecta `npm start` automaticamente

## Estrutura

```
maiaos-api/
├── src/
│   ├── index.js          # Entry point, Express
│   ├── db.js             # Conexão MongoDB
│   ├── models/
│   │   ├── User.js         # collection: users
│   │   ├── TokoinUser.js   # collection: tokoins_users
│   │   └── Transaction.js  # collection: tokoins_transactions
│   └── routes/
│       ├── user.js         # /api/user
│       ├── ranking.js      # /api/ranking
│       └── loja.js         # /api/loja
├── .env.example
├── .gitignore
└── package.json
```
