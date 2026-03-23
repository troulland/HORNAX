export type GameRole = 'top' | 'jgl' | 'mid' | 'adc' | 'sup' | 'sub' | 'coach' | 'manager'

export interface Team {
  id: number
  name: string
  slug: string
  max_players: number
  created_at: string
}

export interface User {
  id: number
  username: string
  email: string
  password_hash: string
  team_id: number | null
  game_role: GameRole | null
  is_starter: number
  is_active: number
  created_at: string
}

export interface JwtPayload {
  userId: number
  username: string
  teamId: number | null
  gameRole: GameRole | null
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}
