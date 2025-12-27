import type { NextApiRequest, NextApiResponse } from 'next'
import {
    getTPAConfigByCode,
    setTPAConfig,
    validateTPAConfig,
    type TPAConfig,
    type TPAMapping
} from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

interface RepairResponse {
    success: boolean
    message: string
    config?: TPAConfig
    validationBefore?: {
        isValid: boolean
        missingFields: string[]
        warnings: string[]
        errors: string[]
    }
    validationAfter?: {
        isValid: boolean
        missingFields: string[]
        warnings: string[]
        errors: string[]
    }
    repaired?: boolean
}

/**
 * Repair TPA config by updating it with provided mapping data
 * POST /api/clinic-config/tpa/repair
 * Body: { clinic_id, ins_code, mapping_data? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<RepairResponse | { error: string }>) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const clinicId = getClinicIdFromQuery(req) || req.body?.clinic_id
    if (!clinicId || typeof clinicId !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const { ins_code, mapping_data } = req.body || {}
    if (!ins_code || typeof ins_code !== 'string') {
        return res.status(400).json({ error: 'ins_code is required' })
    }

    try {
        // Get existing config
        const existingConfig = await getTPAConfigByCode(clinicId, ins_code)
        
        if (!existingConfig) {
            return res.status(404).json({ 
                error: `TPA config not found for ins_code: ${ins_code} and clinic_id: ${clinicId}`
            })
        }

        // Validate existing config
        const validationBefore = validateTPAConfig(existingConfig, true)

        // If mapping data is provided, merge it with existing config
        let updatedConfig: TPAConfig = { ...existingConfig }
        let repaired = false

        if (mapping_data && typeof mapping_data === 'object') {
            // Merge mapping data into config
            updatedConfig = {
                ...existingConfig,
                hospital_insurance_mapping_id: mapping_data.hospital_insurance_mapping_id ?? existingConfig.hospital_insurance_mapping_id,
                insurance_id: mapping_data.insurance_id ?? existingConfig.insurance_id,
                insurance_type: mapping_data.insurance_type ?? existingConfig.insurance_type,
                insurance_name: mapping_data.insurance_name ?? existingConfig.insurance_name,
                ins_payer: mapping_data.ins_payer ?? existingConfig.ins_payer,
                // Preserve other fields
                tpa_id: existingConfig.tpa_id,
                tpa_name: existingConfig.tpa_name,
                api_url: existingConfig.api_url,
                credentials: existingConfig.credentials,
                config_data: existingConfig.config_data,
                lt_site_id: existingConfig.lt_site_id,
                lt_customer_id: existingConfig.lt_customer_id,
                lt_hospital_id: existingConfig.lt_hospital_id,
                lt_other_config: existingConfig.lt_other_config,
                extra_form_fields: existingConfig.extra_form_fields,
            }
            repaired = true
        } else {
            // No mapping data provided - just validate and report
            return res.status(200).json({
                success: false,
                message: 'No mapping data provided. Please provide mapping_data in the request body.',
                config: existingConfig,
                validationBefore,
                repaired: false
            })
        }

        // Validate updated config
        const validationAfter = validateTPAConfig(updatedConfig, true)

        // Save updated config if it's valid or if we made changes
        if (repaired) {
            await setTPAConfig(clinicId, updatedConfig, { skipValidation: true }) // Skip validation since we're doing it manually
        }

        const success = validationAfter.isValid

        return res.status(200).json({
            success,
            message: success 
                ? `TPA config for ${ins_code} has been repaired successfully`
                : `TPA config for ${ins_code} was updated but still has missing fields: ${validationAfter.missingFields.join(', ')}`,
            config: updatedConfig,
            validationBefore,
            validationAfter,
            repaired
        })
    } catch (error: any) {
        console.error('Error repairing TPA config:', error)
        return res.status(500).json({ 
            error: 'Failed to repair TPA config',
            details: error.message || 'Unknown error occurred'
        })
    }
}

