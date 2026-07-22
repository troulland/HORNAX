import { Request, Response } from 'express'
import db from '../db'
import { RiotKeyError } from '../services/riotLimiter'
import { generateCodes, listCodes } from '../services/tournamentCodes'

const REGION = 'euw' // même défaut que la synchro des matchs

async function isViewer(userId: number): Promise<boolean> {
  const row = await db.prepare('SELECT is_viewer FROM users WHERE id = ?').get<{ is_viewer: number }>(userId)
  return !!row?.is_viewer
}

/** POST /api/scrims/tournament-code — génère des codes de tournoi (interdit aux viewers). */
export async function createTournamentCode(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.status(400).json({ error: 'Aucune équipe associée à ce compte' }); return }
  if (await isViewer(req.user!.userId)) { res.status(403).json({ error: 'Compte en lecture seule' }); return }

  const team = await db.prepare('SELECT name FROM teams WHERE id = ?').get<{ name: string }>(teamId)
  const { count, teamSize, mapType, pickType, spectatorType, metadata } = req.body ?? {}

  try {
    const codes = await generateCodes(teamId, req.user!.userId, REGION, team?.name ?? `Team ${teamId}`, {
      count, teamSize, mapType, pickType, spectatorType, metadata,
    })
    res.json({ codes })
  } catch (e) {
    const msg = (e as Error).message || 'Échec de génération des codes'
    // 401 = problème de clé (non configurée / expirée / pas d'accès Tournament) ; 502 = API Riot en échec
    res.status(e instanceof RiotKeyError ? 401 : 502).json({ error: msg })
  }
}

/** GET /api/scrims/tournament-codes — historique des codes de la team. */
export async function getTournamentCodes(req: Request, res: Response): Promise<void> {
  const teamId = req.user!.teamId
  if (!teamId) { res.json({ codes: [] }); return }
  res.json({ codes: await listCodes(teamId) })
}
