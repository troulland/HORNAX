import db from '../db'
import { riotPost } from './riotLimiter'

/**
 * Génération de codes de tournoi via l'API Tournament-V5 de Riot.
 *
 * Flux Riot en 3 temps, avec mise en cache pour ne rien recréer inutilement :
 *   1. provider   (une fois par région)            → app_config[riot_provider_id:*]
 *   2. tournament (une fois par team)              → app_config[riot_tournament_id:*]
 *   3. codes      (à chaque clic)                  → table tournament_code
 *
 * Bascule Stub → Prod : variable d'env RIOT_TOURNAMENT_STUB=1 pour tester
 * (codes factices, non jouables en jeu) sans toucher au code.
 */

const ROUTING: Record<string, string> = {
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  kr: 'asia', jp: 'asia', oce: 'sea',
}

// Région "plateforme" attendue par l'enregistrement du provider (majuscules).
const PLATFORM: Record<string, string> = {
  euw: 'EUW', eune: 'EUNE', tr: 'TR', ru: 'RU',
  na: 'NA', br: 'BR', lan: 'LAN', las: 'LAS',
  kr: 'KR', jp: 'JP', oce: 'OCE',
}

const STUB = process.env.RIOT_TOURNAMENT_STUB === '1'
const V5 = STUB ? 'tournament-stub/v5' : 'tournament/v5'

function host(region: string): string {
  const routing = ROUTING[region] ?? 'europe'
  return `https://${routing}.api.riotgames.com/lol/${V5}`
}

async function getConfig(key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM app_config WHERE key = ?').get<{ value: string }>(key)
  return row?.value ?? null
}
async function setConfig(key: string, value: string): Promise<void> {
  await db.prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

/** ID provider (partagé par région) — enregistré une seule fois puis caché. */
async function ensureProvider(region: string): Promise<number> {
  const cacheKey = `riot_provider_id:${STUB ? 'stub:' : ''}${region}`
  const cached = await getConfig(cacheKey)
  if (cached) return Number(cached)

  const url = process.env.RIOT_TOURNAMENT_CALLBACK_URL ?? 'https://hornax.gg/api/riot/tournament-callback'
  const providerId = await riotPost<number>(`${host(region)}/providers`, {
    region: PLATFORM[region] ?? 'EUW',
    url,
  })
  await setConfig(cacheKey, String(providerId))
  return providerId
}

/** ID tournoi (un par team) — enregistré une seule fois puis caché. */
async function ensureTournament(teamId: number, region: string, name: string): Promise<number> {
  const cacheKey = `riot_tournament_id:${STUB ? 'stub:' : ''}${teamId}`
  const cached = await getConfig(cacheKey)
  if (cached) return Number(cached)

  const providerId = await ensureProvider(region)
  const tournamentId = await riotPost<number>(`${host(region)}/tournaments`, { name, providerId })
  await setConfig(cacheKey, String(tournamentId))
  return tournamentId
}

export interface CodeOptions {
  count?: number
  teamSize?: number
  mapType?: string
  pickType?: string
  spectatorType?: string
  metadata?: string | null
  allowedParticipants?: string[]
}

const MAP_TYPES = new Set(['SUMMONERS_RIFT', 'HOWLING_ABYSS'])
const PICK_TYPES = new Set(['BLIND_PICK', 'DRAFT_MODE', 'ALL_RANDOM', 'TOURNAMENT_DRAFT'])
const SPECTATOR_TYPES = new Set(['NONE', 'LOBBYONLY', 'ALL'])

/** Génère `count` codes, les persiste et les renvoie. */
export async function generateCodes(
  teamId: number,
  createdBy: number,
  region: string,
  teamName: string,
  opts: CodeOptions,
): Promise<string[]> {
  const count = Math.min(Math.max(Math.trunc(opts.count ?? 1), 1), 100)
  const teamSize = Math.min(Math.max(Math.trunc(opts.teamSize ?? 5), 1), 5)
  const mapType = MAP_TYPES.has(opts.mapType!) ? opts.mapType! : 'SUMMONERS_RIFT'
  const pickType = PICK_TYPES.has(opts.pickType!) ? opts.pickType! : 'TOURNAMENT_DRAFT'
  const spectatorType = SPECTATOR_TYPES.has(opts.spectatorType!) ? opts.spectatorType! : 'ALL'
  const metadata = opts.metadata?.trim() || null

  const tournamentId = await ensureTournament(teamId, region, teamName)

  const body: Record<string, unknown> = { mapType, pickType, spectatorType, teamSize }
  if (metadata) body.metadata = metadata
  if (opts.allowedParticipants?.length) body.allowedParticipants = opts.allowedParticipants

  const codes = await riotPost<string[]>(
    `${host(region)}/codes?count=${count}&tournamentId=${tournamentId}`,
    body,
  )

  for (const code of codes) {
    await db.prepare(
      `INSERT OR REPLACE INTO tournament_code
         (code, team_id, tournament_id, map_type, pick_type, spectator_type, team_size, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(code, teamId, tournamentId, mapType, pickType, spectatorType, teamSize, metadata, createdBy)
  }
  return codes
}

export interface StoredCode {
  code: string
  map_type: string
  pick_type: string
  spectator_type: string
  team_size: number
  metadata: string | null
  created_at: string
  created_by_name: string | null
}

/** Derniers codes générés par la team (historique partagé). */
export async function listCodes(teamId: number, limit = 30): Promise<StoredCode[]> {
  return db.prepare(`
    SELECT tc.code, tc.map_type, tc.pick_type, tc.spectator_type, tc.team_size, tc.metadata, tc.created_at,
           u.username AS created_by_name
    FROM tournament_code tc
    LEFT JOIN users u ON u.id = tc.created_by
    WHERE tc.team_id = ?
    ORDER BY tc.created_at DESC
    LIMIT ?
  `).all<StoredCode>(teamId, limit)
}
