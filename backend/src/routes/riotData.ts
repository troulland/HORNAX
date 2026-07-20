import { Router } from 'express'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'
import { syncNow, getScrims, getSoloq, getFlex, getGame } from '../controllers/riotData'

const router = Router()

router.post('/sync',          authGuard, ah(syncNow))
router.get('/scrims',         authGuard, ah(getScrims))
router.get('/ranked/soloq',   authGuard, ah(getSoloq))
router.get('/ranked/flex',    authGuard, ah(getFlex))
router.get('/game/:matchId',  authGuard, ah(getGame))

export default router
