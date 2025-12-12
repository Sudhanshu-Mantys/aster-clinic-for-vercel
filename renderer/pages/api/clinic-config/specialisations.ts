import type { NextApiRequest, NextApiResponse } from 'next'
import { getSpecialisationsMapping, setSpecialisationsMapping } from '../../../lib/redis-config-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    try {
        const mapping = await getSpecialisationsMapping()
        // Convert to array format for easier consumption
        const specialisations = Object.entries(mapping).map(([id, name]) => ({
            specialisation_id: id,
            specialisation_name: name
        }))
        return res.status(200).json({ specialisations, mapping })
    } catch (error) {
        console.error('Failed to get specialisations:', error)
        return res.status(500).json({ error: 'Failed to get specialisations' })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { mapping, specialisations } = req.body || {}

        let finalMapping: Record<string, string> = {}

        // If specialisations array is provided (from JSON import)
        if (Array.isArray(specialisations)) {
            specialisations.forEach((spec: any) => {
                const id = String(spec.specialisation_id || spec.specialisationId || '')
                const name = spec.specialisation_name || spec.specialisationName || ''
                if (id && name) {
                    finalMapping[id] = name
                }
            })
        }
        // If mapping object is provided directly
        else if (mapping && typeof mapping === 'object') {
            finalMapping = mapping
        }
        // If body contains the full API response structure
        else if (req.body?.body?.Data && Array.isArray(req.body.body.Data)) {
            req.body.body.Data.forEach((spec: any) => {
                const id = String(spec.specialisation_id || '')
                const name = spec.specialisation_name || ''
                if (id && name) {
                    finalMapping[id] = name
                }
            })
        }
        // If body.Data is directly an array
        else if (req.body?.Data && Array.isArray(req.body.Data)) {
            req.body.Data.forEach((spec: any) => {
                const id = String(spec.specialisation_id || '')
                const name = spec.specialisation_name || ''
                if (id && name) {
                    finalMapping[id] = name
                }
            })
        }

        if (Object.keys(finalMapping).length === 0) {
            return res.status(400).json({ error: 'No valid specialisation data provided' })
        }

        // Merge with existing mapping (don't overwrite, just update/add)
        const existingMapping = await getSpecialisationsMapping()
        const mergedMapping = { ...existingMapping, ...finalMapping }

        await setSpecialisationsMapping(mergedMapping)

        return res.status(200).json({
            message: 'Specialisations updated successfully',
            mapping: mergedMapping,
            added: Object.keys(finalMapping).length
        })
    } catch (error) {
        console.error('Failed to set specialisations:', error)
        return res.status(500).json({ error: 'Failed to set specialisations' })
    }
}

