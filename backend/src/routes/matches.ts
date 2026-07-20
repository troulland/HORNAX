import { Router } from 'express'
import { getMatches, createMatch, updateMatch, deleteMatch, groupMatches } from '../controllers/matches'
import { upload, uploadLogo } from '../controllers/upload'
import { authGuard } from '../middleware/auth'
import { ah } from '../utils/asyncHandler'

const router = Router()
router.get('/',            authGuard, ah(getMatches))
router.post('/group',      authGuard, ah(groupMatches))
router.post('/',           authGuard, ah(createMatch))
router.put('/:id',         authGuard, ah(updateMatch))
router.delete('/:id',      authGuard, ah(deleteMatch))
router.post('/upload-logo', authGuard, upload.single('logo'), uploadLogo)
export default router
