import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Enrobe un handler asynchrone pour que toute Promise rejetée soit transmise
 * au middleware d'erreurs Express (sinon Express 4 laisse la requête pendante).
 */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }
