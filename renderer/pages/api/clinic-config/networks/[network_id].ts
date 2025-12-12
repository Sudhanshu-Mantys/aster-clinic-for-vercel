import type { NextApiRequest, NextApiResponse } from 'next'
import { setNetworkConfig, deleteNetworkConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return handlePut(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { network_id } = req.query
    if (!network_id || typeof network_id !== 'string') {
        return res.status(400).json({ error: 'network_id is required' })
    }

    const { clinic_id, network_name, network_code, description } = req.body || {}
    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const updated = {
        network_id,
        network_name: network_name || '',
        network_code: network_code || '',
        description: description || '',
        updated_at: new Date().toISOString(),
    }

    await setNetworkConfig(clinic_id, network_id, updated)
    return res.status(200).json({ config: updated })
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { network_id } = req.query
    const clinicId = getClinicIdFromQuery(req)

    if (!network_id || typeof network_id !== 'string') {
        return res.status(400).json({ error: 'network_id is required' })
    }
    if (!clinicId) {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    await deleteNetworkConfig(clinicId, network_id)
    return res.status(200).json({ message: 'Network config deleted successfully' })
}
