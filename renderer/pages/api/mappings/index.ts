import type { NextApiRequest, NextApiResponse } from 'next'
import { getValueMappings, setValueMapping, generateId } from '../../../lib/redis-config-store'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        return handleGet(req, res)
    } else if (req.method === 'POST') {
        return handlePost(req, res)
    } else {
        return res.status(405).json({ error: 'Method not allowed' })
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { clinic_id } = req.query

        if (!clinic_id || typeof clinic_id !== 'string') {
            return res.status(400).json({ error: 'clinic_id is required' })
        }

        const mappings = await getValueMappings(clinic_id)

        return res.status(200).json({ mappings })
    } catch (error) {
        console.error('Error fetching mappings:', error)
        return res.status(500).json({ error: 'Failed to fetch mappings' })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { clinic_id, mapping_type, source_value, target_value, description } = req.body

        if (!clinic_id || !mapping_type || !source_value || !target_value) {
            return res.status(400).json({
                error: 'clinic_id, mapping_type, source_value, and target_value are required'
            })
        }

        const mappingId = generateId()
        const newMapping = {
            id: mappingId,
            clinic_id,
            mapping_type,
            source_value,
            target_value,
            description: description || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        await setValueMapping(clinic_id, mappingId, newMapping)

        return res.status(201).json({ mapping: newMapping })
    } catch (error) {
        console.error('Error creating mapping:', error)
        return res.status(500).json({ error: 'Failed to create mapping' })
    }
}

