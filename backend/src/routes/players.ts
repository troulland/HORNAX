import { Router } from 'express'
import { getPlayerProfile, updateRiotId } from '../controllers/players'
import { authGuard } from '../middleware/auth'

const router = Router()
router.patch('/me/riot-id', authGuard, updateRiotId)
router.get('/:userId', authGuard, getPlayerProfile)
export default router
