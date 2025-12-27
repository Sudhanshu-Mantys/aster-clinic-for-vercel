import type { NextApiRequest, NextApiResponse } from 'next'
import {
    getTPAConfigByCode,
    setTPAConfig,
    deleteTPAConfig,
    type TPAMapping,
    type TPAConfig
} from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

/**
 * TPA Mapping API (uses unified TPA config structure)
 * GET /api/clinic-config/tpa/mapping?clinic_id=xxx&ins_code=TPA036
 * POST /api/clinic-config/tpa/mapping (with mapping data)
 * DELETE /api/clinic-config/tpa/mapping?clinic_id=xxx&ins_code=TPA036
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { ins_code } = req.query
    if (!ins_code || typeof ins_code !== 'string') {
        return res.status(400).json({ error: 'ins_code is required' })
    }

    try {
        // Use Promise.race to implement timeout (10 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
        })

        const configPromise = getTPAConfigByCode(clinicId, ins_code)
        const config = await Promise.race([configPromise, timeoutPromise])

        if (!config) {
            return res.status(404).json({ 
                error: 'TPA mapping not found',
                details: `No TPA config found for ins_code: ${ins_code} and clinic_id: ${clinicId}`,
                suggestion: 'Please ensure the TPA config exists in Redis with the required mapping fields'
            })
        }

        if (!config.insurance_id) {
            return res.status(404).json({ 
                error: 'TPA mapping incomplete',
                details: `TPA config exists for ${ins_code} but is missing required mapping fields`,
                missingFields: {
                    insurance_id: config.insurance_id === undefined,
                    insurance_type: config.insurance_type === undefined,
                    insurance_name: !config.insurance_name,
                    hospital_insurance_mapping_id: !config.hospital_insurance_mapping_id
                },
                suggestion: 'Please update the TPA config with complete mapping data or use the repair endpoint'
            })
        }

        // Return only mapping data for backward compatibility
        const mapping: TPAMapping = {
            hospital_insurance_mapping_id: config.hospital_insurance_mapping_id!,
            insurance_id: config.insurance_id!,
            insurance_type: config.insurance_type!,
            insurance_name: config.insurance_name!,
            ins_payer: config.ins_payer || null,
            ins_code: config.ins_code,
            clinic_id: config.clinic_id,
            created_at: config.created_at,
            updated_at: config.updated_at
        }

        return res.status(200).json({ mapping })
    } catch (error: any) {
        console.error('Error fetching TPA mapping:', error)
        if (error.message?.includes('timeout')) {
            return res.status(504).json({ 
                error: 'Request timeout',
                details: 'The request took longer than 10 seconds to complete',
                suggestion: 'Please check Redis connection and try again'
            })
        }
        return res.status(500).json({ 
            error: 'Failed to fetch TPA mapping',
            details: error.message || 'Unknown error occurred'
        })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { clinic_id, hospital_insurance_mapping_id, insurance_id, insurance_type, insurance_name, ins_payer, ins_code } = req.body || {}

    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }
    if (!ins_code || typeof ins_code !== 'string') {
        return res.status(400).json({ error: 'ins_code is required' })
    }
    if (hospital_insurance_mapping_id === undefined || insurance_id === undefined || insurance_type === undefined) {
        return res.status(400).json({ 
            error: 'hospital_insurance_mapping_id, insurance_id, and insurance_type are required',
            received: {
                hospital_insurance_mapping_id: hospital_insurance_mapping_id !== undefined,
                insurance_id: insurance_id !== undefined,
                insurance_type: insurance_type !== undefined
            }
        })
    }
    if (!insurance_name || typeof insurance_name !== 'string') {
        return res.status(400).json({ error: 'insurance_name is required and must be a string' })
    }

    try {
        const config: TPAConfig = {
            hospital_insurance_mapping_id,
            insurance_id,
            insurance_type,
            insurance_name,
            ins_payer: ins_payer || null,
            ins_code,
        }

        await setTPAConfig(clinic_id, config)

        // Return mapping format for backward compatibility
        const mapping: TPAMapping = {
            hospital_insurance_mapping_id,
            insurance_id,
            insurance_type,
            insurance_name,
            ins_payer: ins_payer || null,
            ins_code,
        }

        return res.status(201).json({ mapping })
    } catch (error: any) {
        console.error('Error setting TPA mapping:', error)
        return res.status(500).json({ 
            error: 'Failed to save TPA mapping',
            details: error.message || 'Unknown error occurred'
        })
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { ins_code } = req.query
    if (!ins_code || typeof ins_code !== 'string') {
        return res.status(400).json({ error: 'ins_code is required' })
    }

    await deleteTPAConfig(clinicId, ins_code)
    return res.status(200).json({ message: 'TPA mapping deleted successfully' })
}

