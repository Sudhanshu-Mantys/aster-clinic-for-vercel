import type { NextApiRequest, NextApiResponse } from 'next'
import { getValueMappingById, setValueMapping, deleteValueMapping } from '../../../lib/redis-config-store'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Mapping ID is required' })
    }

    if (req.method === 'PUT') {
        return handlePut(req, res, id)
    } else if (req.method === 'DELETE') {
        return handleDelete(req, res, id)
    } else {
        return res.status(405).json({ error: 'Method not allowed' })
    }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse, id: string) {
    try {
        const { mapping_type, source_value, target_value, description } = req.body

        if (!mapping_type || !source_value || !target_value) {
            return res.status(400).json({
                error: 'mapping_type, source_value, and target_value are required'
            })
        }

        // Find the existing mapping
        const result = await getValueMappingById(id)
        if (!result) {
            return res.status(404).json({ error: 'Mapping not found' })
        }

        const { clinicId, mapping: existingMapping } = result

        const updatedMapping = {
            ...existingMapping,
            mapping_type,
            source_value,
            target_value,
            description: description || '',
            updated_at: new Date().toISOString()
        }

        await setValueMapping(clinicId, id, updatedMapping)

        return res.status(200).json({ mapping: updatedMapping })
    } catch (error) {
        console.error('Error updating mapping:', error)
        return res.status(500).json({ error: 'Failed to update mapping' })
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, id: string) {
    try {
        // Find the existing mapping
        const result = await getValueMappingById(id)
        if (!result) {
            return res.status(404).json({ error: 'Mapping not found' })
        }

        const { clinicId } = result
        await deleteValueMapping(clinicId, id)

        return res.status(200).json({ message: 'Mapping deleted successfully' })
    } catch (error) {
        console.error('Error deleting mapping:', error)
        return res.status(500).json({ error: 'Failed to delete mapping' })
    }
}

