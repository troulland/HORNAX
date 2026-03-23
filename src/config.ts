const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const API_BASE   = base.endsWith('/api') ? base : `${base}/api`
export const STATIC_BASE = base.endsWith('/api') ? base.replace(/\/api$/, '') : base
