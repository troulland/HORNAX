import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../types'

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Non autorisé' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'fallback') as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' })
  }
}
