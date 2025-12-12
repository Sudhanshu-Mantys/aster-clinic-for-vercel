import type { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfigs, setNetworkConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const configs = await getNetworkConfigs(clinicId)
    return res.status(200).json({ configs })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { clinic_id, network_id, network_name, network_code, description } = req.body || {}
    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }
    if (!network_id || typeof network_id !== 'string') {
        return res.status(400).json({ error: 'network_id is required' })
    }
    if (!network_name || typeof network_name !== 'string') {
        return res.status(400).json({ error: 'network_name is required' })
    }

    const config = {
        network_id,
        network_name,
        network_code: network_code || '',
        description: description || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    await setNetworkConfig(clinic_id, network_id, config)
    return res.status(201).json({ config })
}
