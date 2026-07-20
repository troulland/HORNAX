import { ref } from 'vue'

/**
 * Version Data Dragon : par défaut une valeur de repli, puis mise à jour avec la
 * DERNIÈRE version dès qu'elle est récupérée → les nouveaux champions (Yunara,
 * Ambessa, etc.) ont leurs icônes. La ref étant réactive, les <img> se rafraîchissent.
 */
export const ddVersion = ref('15.6.1')

fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  .then(r => r.json())
  .then((v: string[]) => { if (Array.isArray(v) && v[0]) ddVersion.value = v[0] })
  .catch(() => { /* garde le repli */ })

// Nom d'affichage → nom de fichier ddragon (cas particuliers)
const CHAMP_SPECIAL: Record<string, string> = {
  FiddleSticks: 'Fiddlesticks',
  Wukong: 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
  'Renata Glasc': 'Renata',
  'Dr. Mundo': 'DrMundo',
  LeBlanc: 'Leblanc',
  "Cho'Gath": 'Chogath',
  "Kai'Sa": 'Kaisa',
  "Kha'Zix": 'Khazix',
  "Kog'Maw": 'KogMaw',
  "Rek'Sai": 'RekSai',
  "Vel'Koz": 'Velkoz',
  "K'Sante": 'KSante',
  "Bel'Veth": 'Belveth',
}

export function champIcon(name: string | null | undefined): string {
  if (!name) return ''
  const file = CHAMP_SPECIAL[name] ?? name.replace(/[^A-Za-z0-9]/g, '')
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion.value}/img/champion/${file}.png`
}

export function itemIcon(id: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion.value}/img/item/${id}.png`
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
