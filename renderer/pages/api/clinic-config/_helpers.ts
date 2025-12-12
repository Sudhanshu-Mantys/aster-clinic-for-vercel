import type { NextApiRequest } from 'next'

export function getClinicIdFromQuery(req: NextApiRequest): string | null {
    const clinic_id = req.query.clinic_id
    if (!clinic_id || typeof clinic_id !== 'string') return null
    return clinic_id
}

export function safeJsonString(input: unknown): string {
    if (typeof input !== 'string') return '{}'
    const trimmed = input.trim()
    if (!trimmed) return '{}'
    try {
        JSON.parse(trimmed)
        return trimmed
    } catch {
        // Store as-is but keep it JSON-valid by wrapping
        return JSON.stringify({ raw: trimmed })
    }
}


