import { Router } from 'express'
import { fetchRiotMatches } from '../controllers/riot'
import { authGuard } from '../middleware/auth'

const router = Router()
router.get('/matches', authGuard, fetchRiotMatches)
export default router
