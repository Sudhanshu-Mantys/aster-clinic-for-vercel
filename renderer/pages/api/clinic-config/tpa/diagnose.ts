import type { NextApiRequest, NextApiResponse } from 'next'
import {
    getTPAConfigs,
    getTPAConfigByCode,
    type TPAConfig
} from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

interface ValidationResult {
    isValid: boolean
    missingFields: string[]
    warnings: string[]
}

interface TPAConfigDiagnostic {
    ins_code: string
    exists: boolean
    config?: TPAConfig
    validation: ValidationResult
}

interface DiagnosticResponse {
    clinicId: string
    timestamp: string
    totalConfigs: number
    incompleteConfigs: number
    configs: TPAConfigDiagnostic[]
    summary: {
        total: number
        complete: number
        incomplete: number
        missingMappingId: number
        missingInsuranceId: number
        missingInsuranceName: number
    }
}

/**
 * Validate TPA config for required mapping fields
 */
function validateTPAConfigForMapping(config: TPAConfig): ValidationResult {
    const missingFields: string[] = []
    const warnings: string[] = []

    // Required fields for mapping
    if (!config.hospital_insurance_mapping_id) {
        missingFields.push('hospital_insurance_mapping_id')
    }
    if (config.insurance_id === undefined || config.insurance_id === null) {
        missingFields.push('insurance_id')
    }
    if (config.insurance_type === undefined || config.insurance_type === null) {
        missingFields.push('insurance_type')
    }
    if (!config.insurance_name) {
        missingFields.push('insurance_name')
    }
    if (!config.ins_code) {
        missingFields.push('ins_code')
    }

    // Warnings for optional but recommended fields
    if (!config.ins_payer) {
        warnings.push('ins_payer is missing (optional but recommended)')
    }

    return {
        isValid: missingFields.length === 0,
        missingFields,
        warnings
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DiagnosticResponse | { error: string; details?: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const { ins_code } = req.query

    try {
        // If specific ins_code is requested, diagnose only that one
        if (ins_code && typeof ins_code === 'string') {
            const config = await getTPAConfigByCode(clinicId, ins_code)
            const validation = config ? validateTPAConfigForMapping(config) : {
                isValid: false,
                missingFields: ['config_not_found'],
                warnings: []
            }

            const diagnostic: TPAConfigDiagnostic = {
                ins_code,
                exists: !!config,
                config: config || undefined,
                validation
            }

            return res.status(200).json({
                clinicId,
                timestamp: new Date().toISOString(),
                totalConfigs: config ? 1 : 0,
                incompleteConfigs: validation.isValid ? 0 : 1,
                configs: [diagnostic],
                summary: {
                    total: 1,
                    complete: validation.isValid ? 1 : 0,
                    incomplete: validation.isValid ? 0 : 1,
                    missingMappingId: validation.missingFields.includes('hospital_insurance_mapping_id') ? 1 : 0,
                    missingInsuranceId: validation.missingFields.includes('insurance_id') ? 1 : 0,
                    missingInsuranceName: validation.missingFields.includes('insurance_name') ? 1 : 0
                }
            })
        }

        // Otherwise, diagnose all TPA configs
        const configs = await getTPAConfigs(clinicId)
        const diagnostics: TPAConfigDiagnostic[] = configs.map(config => ({
            ins_code: config.ins_code || config.tpa_id || 'unknown',
            exists: true,
            config,
            validation: validateTPAConfigForMapping(config)
        }))

        const summary = {
            total: diagnostics.length,
            complete: diagnostics.filter(d => d.validation.isValid).length,
            incomplete: diagnostics.filter(d => !d.validation.isValid).length,
            missingMappingId: diagnostics.filter(d => d.validation.missingFields.includes('hospital_insurance_mapping_id')).length,
            missingInsuranceId: diagnostics.filter(d => d.validation.missingFields.includes('insurance_id')).length,
            missingInsuranceName: diagnostics.filter(d => d.validation.missingFields.includes('insurance_name')).length
        }

        return res.status(200).json({
            clinicId,
            timestamp: new Date().toISOString(),
            totalConfigs: configs.length,
            incompleteConfigs: summary.incomplete,
            configs: diagnostics,
            summary
        })
    } catch (error: any) {
        console.error('Error diagnosing TPA configs:', error)
        return res.status(500).json({ error: 'Failed to diagnose TPA configs', details: error.message })
    }
}

