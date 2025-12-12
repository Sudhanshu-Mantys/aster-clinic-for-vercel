import type { NextApiRequest, NextApiResponse } from 'next'
import {
    getTPAConfigs,
    setTPAConfig,
    bulkImportTPAMappings,
    getAllTPAMappings,
    type TPAMapping,
    type TPAConfig
} from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    // Check if requesting mappings only (filtered to show only mapping data)
    const { mappings } = req.query
    if (mappings === 'true') {
        const tpaMappings = await getAllTPAMappings(clinicId)
        return res.status(200).json({ mappings: tpaMappings })
    }

    // Return all TPA configs (includes both config and mapping data)
    const configs = await getTPAConfigs(clinicId)
    return res.status(200).json({ configs })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { clinic_id, bulk_import, mappings } = req.body || {}

    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    // Handle bulk import of TPA mappings
    if (bulk_import === true && Array.isArray(mappings)) {
        try {
            // Validate mapping structure
            const validMappings: TPAMapping[] = mappings
                .filter((m: any) =>
                    m.hospital_insurance_mapping_id &&
                    m.insurance_id !== undefined &&
                    m.insurance_type !== undefined &&
                    m.insurance_name &&
                    m.ins_code
                )
                .map((m: any) => ({
                    hospital_insurance_mapping_id: m.hospital_insurance_mapping_id,
                    insurance_id: m.insurance_id,
                    insurance_type: m.insurance_type,
                    insurance_name: m.insurance_name,
                    ins_payer: m.ins_payer || null,
                    ins_code: m.ins_code,
                }))

            if (validMappings.length === 0) {
                return res.status(400).json({ error: 'No valid mappings provided' })
            }

            const result = await bulkImportTPAMappings(clinic_id, validMappings)
            return res.status(201).json({
                message: 'TPA mappings imported successfully',
                imported: result.imported,
                errors: result.errors
            })
        } catch (error: any) {
            console.error('Error bulk importing TPA mappings:', error)
            return res.status(500).json({ error: 'Failed to import TPA mappings', details: error.message })
        }
    }

    // Handle single TPA config (existing behavior)
    const {
        tpa_id,
        tpa_name,
        api_url,
        credentials,
        config_data,
        ins_code,
        lt_site_id,
        lt_customer_id,
        lt_hospital_id,
        lt_other_config,
        extra_form_fields
    } = req.body || {}

    // Either ins_code or tpa_id is required
    const identifier = ins_code || tpa_id
    if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: 'Either ins_code or tpa_id is required' })
    }
    if (!tpa_name || typeof tpa_name !== 'string') {
        return res.status(400).json({ error: 'tpa_name is required' })
    }

    const config: TPAConfig = {
        ins_code: ins_code || identifier,
        tpa_id: tpa_id || identifier,
        tpa_name,
        api_url: api_url || '',
        credentials: credentials || '',
        config_data: config_data || {},
        lt_site_id: lt_site_id || undefined,
        lt_customer_id: lt_customer_id || undefined,
        lt_hospital_id: lt_hospital_id || undefined,
        lt_other_config: lt_other_config || undefined,
        extra_form_fields: extra_form_fields || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    await setTPAConfig(clinic_id, config)
    return res.status(201).json({ config })
}
