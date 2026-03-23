import { Router } from 'express'
import { authGuard } from '../middleware/auth'
import { getWeekAvailability, setAvailability } from '../controllers/availability'

const router = Router()

router.get('/', authGuard, getWeekAvailability)
router.put('/', authGuard, setAvailability)

export default router
