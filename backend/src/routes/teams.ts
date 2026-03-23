import { Router } from 'express'
import { getTeams, getTeamRoster } from '../controllers/teams'

const router = Router()

router.get('/', getTeams)
router.get('/:id/roster', getTeamRoster)

export default router
