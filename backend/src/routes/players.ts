import { Router } from 'express'
import { getPlayerProfile, updateRiotId } from '../controllers/players'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'

const router = Router()
router.patch('/me/riot-id', authGuard, ah(updateRiotId))
router.get('/:userId', authGuard, ah(getPlayerProfile))
export default router
