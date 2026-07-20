# Déploiement HORNAX — Turso + Render (100 % gratuit)

Le backend utilise désormais **libSQL** (`@libsql/client`) au lieu de `node:sqlite`.
Le même code marche :

- **en local** → fichier `data/hornax.db` (rien à configurer)
- **en prod**  → base **Turso** (managée, durable, gratuite) via 2 variables d'env

> ⚠️ Plus jamais de perte de données : la base ne vit plus dans le conteneur
> (système de fichiers éphémère), mais sur Turso.

---

## 1. Créer la base Turso (gratuit)

### Via le dashboard (le plus simple, Windows-friendly)
1. Crée un compte sur **https://turso.tech** (plan gratuit).
2. **Create Database** → choisis une région proche (ex. `Frankfurt` / `Paris`).
3. Nomme-la `hornax`.
4. Récupère l'**URL** de la base : elle ressemble à `libsql://hornax-xxxx.turso.io`
5. Génère un **token** (bouton *Create Token* / *Generate Token*) → chaîne `eyJ...`

### Ou via la CLI Turso
```bash
turso auth signup
turso db create hornax
turso db show hornax --url            # → libsql://hornax-xxxx.turso.io
turso db tokens create hornax         # → eyJ...
```

La base démarre **vide** : au premier lancement, l'API crée le schéma et les
2 équipes (`HORNAX`, `HORNAX ROYALTY`). **Aucun membre** (reset voulu).

---

## 2. Déployer l'API sur Render (gratuit)

1. Compte sur **https://render.com** → **New +** → **Web Service** → connecte ton repo GitHub.
2. Réglages :

   | Champ | Valeur |
   |---|---|
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

3. **Environment** → ajoute les variables :

   | Clé | Valeur |
   |---|---|
   | `JWT_SECRET` | une longue chaîne aléatoire |
   | `DATABASE_URL` | `libsql://hornax-xxxx.turso.io` |
   | `DATABASE_AUTH_TOKEN` | `eyJ...` (le token Turso) |
   | `RIOT_API_KEY` | ta clé Riot (optionnel) |

   > `PORT` est fourni automatiquement par Render — ne pas le définir.

4. **Deploy**. Une fois en ligne, teste : `https://<ton-service>.onrender.com/api/health`

> 💤 Le plan gratuit Render met le service en veille après inactivité :
> la 1re requête peut mettre ~30–60 s (cold start). Normal.
>
> 🖼️ Les logos d'adversaires uploadés (`/logos`) ne survivent pas à un redéploiement
> sur Render gratuit (disque éphémère). Les données (comptes/matchs) sont sur Turso, elles OK.

---

## 3. Brancher le front (Vercel)

Dans le projet Vercel → **Settings → Environment Variables** :

| Clé | Valeur |
|---|---|
| `VITE_API_URL` | `https://<ton-service>.onrender.com` |

Puis **Redeploy**. (`config.ts` ajoute `/api` tout seul.)

---

## 4. Créer les comptes (seeder) — à coller dans la console

Le seeder cible **la base pointée par tes variables d'env**. Pour remplir la base
**Turso de prod**, on lance le seeder en local en pointant vers Turso.

### Étape A — éditer la liste des comptes
Ouvre `backend/src/seed.ts` et remplis le tableau `ACCOUNTS` :

```ts
const ACCOUNTS: Account[] = [
  // === HORNAX ===
  { team: 'hornax', username: 'Kaishi',   role: 'mid', password: 'monMotDePasse' },
  { team: 'hornax', username: 'InuTop',   role: 'top' },   // password → SEED_PASSWORD par défaut
  { team: 'hornax', username: 'JglMain',  role: 'jgl' },
  { team: 'hornax', username: 'AdcName',  role: 'adc' },
  { team: 'hornax', username: 'SuppName', role: 'sup' },

  // === HORNAX ROYALTY ===
  { team: 'hornax-royalty', username: 'RoyMid', role: 'mid' },
]
```

Champs : `team` (`hornax` | `hornax-royalty`), `username`, `role`
(`top`/`jgl`/`mid`/`adc`/`sup`/`sub`/`coach`/`manager`), `password?`, `email?`, `starter?`.

### Étape B — pointer vers Turso puis lancer

**PowerShell (Windows) :**
```powershell
cd backend
$env:DATABASE_URL       = "libsql://hornax-xxxx.turso.io"
$env:DATABASE_AUTH_TOKEN = "eyJ..."
npm run seed
```

**Bash (macOS/Linux/WSL) :**
```bash
cd backend
export DATABASE_URL="libsql://hornax-xxxx.turso.io"
export DATABASE_AUTH_TOKEN="eyJ..."
npm run seed
```

Le seeder affiche pour chaque compte : `login` (email) + `pass`.
Il **ignore** les comptes déjà existants (ré-exécutable sans risque).

### Repartir de zéro (reset complet des membres)
```bash
npm run seed:reset      # supprime TOUS les membres puis recrée ACCOUNTS[]
```

---

## 5. Alternative : créer un compte à la volée (sans seeder)

Directement via l'API en prod (`team_id` : `1` = HORNAX, `2` = HORNAX ROYALTY) :

```bash
curl -X POST https://<ton-service>.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"Kaishi","email":"kaishi@hornax.gg","password":"secret","team_id":1,"game_role":"mid"}'
```
