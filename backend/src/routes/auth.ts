import { Router } from 'express'
import { register, login, me, updateProfile } from '../controllers/auth'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'

const router = Router()

router.post('/register', ah(register))
router.post('/login',    ah(login))
router.get('/me',        authGuard, ah(me))
router.patch('/profile', authGuard, ah(updateProfile))

export default router
