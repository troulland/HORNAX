import { Router } from 'express'
import { authGuard } from '../middleware/auth'
import { getWeekAvailability, setAvailability } from '../controllers/availability'
import { ah } from '../utils/asyncHandler'

const router = Router()

router.get('/', authGuard, ah(getWeekAvailability))
router.put('/', authGuard, ah(setAvailability))

export default router
