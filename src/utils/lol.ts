export const DD_VER = '15.6.1'

// Noms de fichiers ddragon qui diffèrent du nom d'API
const CHAMP_SPECIAL: Record<string, string> = {
  FiddleSticks: 'Fiddlesticks',
  Wukong: 'MonkeyKing',
}

export function champIcon(name: string | null | undefined): string {
  if (!name) return ''
  const file = CHAMP_SPECIAL[name] ?? name
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/champion/${file}.png`
}

export function itemIcon(id: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VER}/img/item/${id}.png`
}

/** secondes → "31:24" */
export function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** timestamp ms → "il y a 3 j" / "il y a 2 h" */
export function fmtAgo(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

export const wrColor = (wr: number) => (wr >= 60 ? '#10B981' : wr >= 50 ? '#F59E0B' : '#EF4444')
