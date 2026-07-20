/**
 * Client Riot API centralisé et THROTTLÉ.
 *
 * Respecte les limites d'une clé dev/perso :
 *   - 20 requêtes / 1 s
 *   - 100 requêtes / 2 min   (on vise 95 pour garder une marge)
 * + backoff automatique sur 429 (lecture de Retry-After).
 *
 * TOUS les appels Riot doivent passer par riotGet() → jamais de fetch direct.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface Window { times: number[]; limit: number; windowMs: number }

class RateLimiter {
  private windows: Window[] = [
    { times: [], limit: 20, windowMs: 1_000 },
    { times: [], limit: 95, windowMs: 120_000 },
  ]
  private chain: Promise<void> = Promise.resolve()

  private prune(now: number): void {
    for (const w of this.windows) {
      const cutoff = now - w.windowMs
      while (w.times.length && w.times[0] <= cutoff) w.times.shift()
    }
  }

  private waitMs(now: number): number {
    let wait = 0
    for (const w of this.windows) {
      if (w.times.length >= w.limit) {
        wait = Math.max(wait, w.times[0] + w.windowMs - now)
      }
    }
    return wait
  }

  /** Réserve un créneau ; sérialisé pour un comptage exact. */
  async acquire(): Promise<void> {
    const run = async (): Promise<void> => {
      for (;;) {
        const now = Date.now()
        this.prune(now)
        const w = this.waitMs(now)
        if (w <= 0) break
        await sleep(w + 5)
      }
      const t = Date.now()
      for (const win of this.windows) win.times.push(t)
    }
    const next = this.chain.then(run)
    this.chain = next.catch(() => {})
    return next
  }
}

export const limiter = new RateLimiter()

export class RiotNotFound extends Error {}
export class RiotKeyError extends Error {}

/** GET Riot throttlé + robuste (retry 429 / 5xx). Renvoie le JSON typé. */
export async function riotGet<T = any>(url: string, retries = 3): Promise<T> {
  const key = process.env.RIOT_API_KEY
  if (!key || key.startsWith('RGAPI-REMPLACE')) {
    throw new RiotKeyError('Clé API Riot non configurée (RIOT_API_KEY)')
  }

  for (let attempt = 0; ; attempt++) {
    await limiter.acquire()
    const res = await fetch(url, { headers: { 'X-Riot-Token': key } })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2')
      await sleep((retryAfter + 1) * 1_000)
      continue
    }
    if (res.status === 404) throw new RiotNotFound('Ressource Riot introuvable')
    if (res.status === 403) throw new RiotKeyError('Clé API Riot expirée ou invalide')
    if (!res.ok) {
      if (res.status >= 500 && attempt < retries) { await sleep(1_000 * (attempt + 1)); continue }
      throw new Error(`Erreur Riot API (${res.status})`)
    }
    return res.json() as Promise<T>
  }
}
