import { Router } from 'express'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'
import { saveScoutTeam, listScoutTeams, deleteScoutTeam, analyzeScout } from '../controllers/scout'

const router = Router()

router.get('/teams',         authGuard, ah(listScoutTeams))
router.post('/teams',        authGuard, ah(saveScoutTeam))
router.delete('/teams/:id',  authGuard, ah(deleteScoutTeam))
router.post('/analyze',      authGuard, ah(analyzeScout))

export default router
