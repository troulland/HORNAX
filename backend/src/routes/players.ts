import { Router } from 'express'
import { getPlayerProfile } from '../controllers/players'
import { authGuard } from '../middleware/auth'

const router = Router()
router.get('/:userId', authGuard, getPlayerProfile)
export default router
