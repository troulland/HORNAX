import { Router } from 'express'
import { fetchRiotMatches, scoutPlayer } from '../controllers/riot'
import { authGuard } from '../middleware/auth'

const router = Router()
router.get('/matches', authGuard, fetchRiotMatches)
router.get('/scout',   authGuard, scoutPlayer)
export default router
