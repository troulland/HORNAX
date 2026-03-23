import { Router } from 'express'
import { getMatches, createMatch, updateMatch, deleteMatch, groupMatches } from '../controllers/matches'
import { upload, uploadLogo } from '../controllers/upload'
import { authGuard } from '../middleware/auth'

const router = Router()
router.get('/',            authGuard, getMatches)
router.post('/group',      authGuard, groupMatches)
router.post('/',           authGuard, createMatch)
router.put('/:id',         authGuard, updateMatch)
router.delete('/:id',      authGuard, deleteMatch)
router.post('/upload-logo', authGuard, upload.single('logo'), uploadLogo)
export default router
