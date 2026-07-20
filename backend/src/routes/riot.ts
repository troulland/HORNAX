import { Router } from 'express'
import { fetchRiotMatches, scoutPlayer } from '../controllers/riot'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'

const router = Router()
router.get('/matches', authGuard, ah(fetchRiotMatches))
router.get('/scout',   authGuard, ah(scoutPlayer))
export default router
