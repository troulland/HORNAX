import { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const logosDir = path.resolve(__dirname, '../../../data/logos')
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `logo_${Date.now()}${ext}`
    cb(null, name)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Format non supporté (png, jpg, gif, webp, svg)'))
  },
})

export function uploadLogo(req: Request, res: Response): void {
  if (!req.file) { res.status(400).json({ error: 'Aucun fichier reçu' }); return }
  res.json({ url: `/logos/${req.file.filename}` })
}
