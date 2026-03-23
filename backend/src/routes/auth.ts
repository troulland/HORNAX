import { Router } from 'express'
import { register, login, me, updateProfile } from '../controllers/auth'
import { authGuard } from '../middleware/auth'

const router = Router()

router.post('/register', register)
router.post('/login',    login)
router.get('/me',        authGuard, me)
router.patch('/profile', authGuard, updateProfile)

export default router
