import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import authRoutes         from './routes/auth'
import teamRoutes         from './routes/teams'
import availabilityRoutes from './routes/availability'
import matchRoutes        from './routes/matches'
import riotRoutes         from './routes/riot'
import playersRoutes      from './routes/players'

const app  = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins (dev)
  credentials: true,
}))
app.use(express.json())
app.use('/logos', express.static(path.resolve(__dirname, '../../data/logos')))

app.use('/api/auth',         authRoutes)
app.use('/api/teams',        teamRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/matches',      matchRoutes)
app.use('/api/riot',         riotRoutes)
app.use('/api/players',     playersRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hornax-api', timestamp: new Date().toISOString() })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⚡ HORNAX API running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})
