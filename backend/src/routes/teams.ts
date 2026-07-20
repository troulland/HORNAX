import { Router } from 'express'
import { getTeams, getTeamRoster } from '../controllers/teams'
import { ah } from '../utils/asyncHandler'

const router = Router()

router.get('/', ah(getTeams))
router.get('/:id/roster', ah(getTeamRoster))

export default router
