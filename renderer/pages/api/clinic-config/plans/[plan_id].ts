import type { NextApiRequest, NextApiResponse } from 'next'
import { setPlanConfig, deletePlanConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return handlePut(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { plan_id } = req.query
    if (!plan_id || typeof plan_id !== 'string') {
        return res.status(400).json({ error: 'plan_id is required' })
    }

    const { clinic_id, plan_name, plan_code, description } = req.body || {}
    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const updated = {
        plan_id,
        plan_name: plan_name || '',
        plan_code: plan_code || '',
        description: description || '',
        updated_at: new Date().toISOString(),
    }

    await setPlanConfig(clinic_id, plan_id, updated)
    return res.status(200).json({ config: updated })
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { plan_id } = req.query
    const clinicId = getClinicIdFromQuery(req)

    if (!plan_id || typeof plan_id !== 'string') {
        return res.status(400).json({ error: 'plan_id is required' })
    }
    if (!clinicId) {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    await deletePlanConfig(clinicId, plan_id)
    return res.status(200).json({ message: 'Plan config deleted successfully' })
}
