/**
 * Mantys API Utility Functions
 * Helper functions for working with Mantys API responses
 */

import {
    MantysEligibilityResponse,
    MantysKeyFields,
    MantysEligibilityRequest,
    TPACode,
    IDType,
    VisitType
} from '../types/mantys'

/**
 * Extract key fields from Mantys API response
 */
export function extractMantysKeyFields(response: MantysEligibilityResponse): MantysKeyFields {
    const { data } = response

    // Extract primary network from policy_network.all_networks
    const primaryNetwork = data.policy_network?.all_networks?.[0]?.network || null

    return {
        network: primaryNetwork,
        copayDetails: data.copay_details_to_fill || [],
        memberId: data.patient_info?.policy_primary_member_id || '',
        isEligible: data.is_eligible,
        policyStartDate: data.policy_network?.start_date || '',
        policyEndDate: data.policy_network?.valid_upto || '',
        payerName: data.policy_network?.payer_name || '',
        specialRemarks: data.copay_analysis?.special_remarks || [],
        referralDocuments: data.referral_documents || []
    }
}

/**
 * Build Mantys eligibility check payload based on API specification
 */
export function buildMantysPayload(params: {
    idValue: string
    tpaId: TPACode
    idType: IDType
    visitType: VisitType
    doctorName?: string
    payerName?: string
    extraArgs?: {
        title: string
        value: string
    }
}): MantysEligibilityRequest {
    const payload: MantysEligibilityRequest = {
        id_value: params.idValue,
        id_type: params.idType,
        tpa_name: params.tpaId,
        visit_type: params.visitType,
        doctorName: params.doctorName || '',
        payerName: params.payerName || ''
    }

    // Add extra_args if provided
    if (params.extraArgs) {
        payload.extra_args = params.extraArgs
    } else {
        payload.extra_args = {
            title: '',
            value: ''
        }
    }

    return payload
}

/**
 * Call Mantys eligibility check API
 */
export async function checkMantysEligibility(
    request: MantysEligibilityRequest
): Promise<MantysEligibilityResponse> {
    try {
        const response = await fetch('/api/mantys/eligibility-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `API request failed with status ${response.status}`)
        }

        return data
    } catch (error) {
        console.error('Error checking Mantys eligibility:', error)
        throw error
    }
}

/**
 * Format Emirates ID with dashes
 */
export function formatEmiratesId(id: string): string {
    const digits = id.replace(/\D/g, '')

    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    if (digits.length <= 14) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`

    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14, 15)}`
}

/**
 * Format DHA Member ID with dashes
 */
export function formatDhaMemberId(id: string): string {
    const alphanumeric = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

    let formatted = ''
    if (alphanumeric.length > 0) {
        formatted += alphanumeric.substring(0, Math.min(4, alphanumeric.length))
    }
    if (alphanumeric.length > 4) {
        formatted += '-' + alphanumeric.substring(4, Math.min(7, alphanumeric.length))
    }
    if (alphanumeric.length > 7) {
        formatted += '-' + alphanumeric.substring(7, Math.min(16, alphanumeric.length))
    }
    if (alphanumeric.length > 16) {
        formatted += '-' + alphanumeric.substring(16, Math.min(18, alphanumeric.length))
    }

    return formatted
}

/**
 * Validate Emirates ID format
 */
export function isValidEmiratesId(id: string): boolean {
    const emiratesIdRegex = /^\d{3}-\d{4}-\d{7}-\d{1}$/
    return emiratesIdRegex.test(id)
}

/**
 * Validate DHA Member ID format
 */
export function isValidDhaMemberId(id: string): boolean {
    const dhaMemberIdRegex = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{3}-[A-Za-z0-9]{9}-[A-Za-z0-9]{2}$/
    return dhaMemberIdRegex.test(id)
}

/**
 * Get TPA-specific requirements for building payload
 */
export function getTPARequirements(tpaCode: TPACode): {
    requiresPhone: boolean
    requiresDoctorName: boolean
    requiresPayerName: boolean
    requiresName: boolean
    supportedIdTypes: IDType[]
    supportedVisitTypes: VisitType[]
    hasMaternityExtraArgs: boolean
} {
    // Define TPA-specific requirements based on documentation
    const requirements: Record<string, any> = {
        TPA004: { // NAS
            requiresPhone: true,
            requiresDoctorName: false,
            requiresPayerName: false,
            requiresName: false,
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER', 'DHAMEMBERID'],
            supportedVisitTypes: ['OUTPATIENT', 'INPATIENT', 'DENTAL', 'OPTICAL', 'MATERNITY', 'PSYCHIATRY', 'WELLNESS'],
            hasMaternityExtraArgs: true
        },
        TPA001: { // Neuron
            requiresPhone: true,
            requiresDoctorName: false,
            requiresPayerName: false,
            requiresName: false,
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER', 'DHAMEMBERID'],
            supportedVisitTypes: ['OUTPATIENT', 'INPATIENT', 'DENTAL', 'OPTICAL', 'MATERNITY', 'PSYCHIATRY', 'WELLNESS'],
            hasMaternityExtraArgs: true
        },
        TPA036: { // Mednet
            requiresPhone: true,
            requiresDoctorName: false,
            requiresPayerName: false,
            requiresName: false,
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER', 'DHAMEMBERID'],
            supportedVisitTypes: ['OUTPATIENT', 'EMERGENCY'],
            hasMaternityExtraArgs: false
        },
        INS012: { // Oman / Sukoon
            requiresPhone: true,
            requiresDoctorName: false,
            requiresPayerName: false,
            requiresName: false,
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER'],
            supportedVisitTypes: ['OUTPATIENT'],
            hasMaternityExtraArgs: false
        },
        TPA029: { // Ecare
            requiresPhone: true,
            requiresDoctorName: true,
            requiresPayerName: false,
            requiresName: false,
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER'],
            supportedVisitTypes: ['OUTPATIENT', 'INPATIENT'],
            hasMaternityExtraArgs: false
        },
        TPA002: { // NextCare
            requiresPhone: false,
            requiresDoctorName: false,
            requiresPayerName: true, // Only for POLICYNUMBER
            requiresName: true, // Only for POLICYNUMBER
            supportedIdTypes: ['EMIRATESID', 'CARDNUMBER', 'DHAMEMBERID', 'POLICYNUMBER'],
            supportedVisitTypes: ['INPATIENT', 'OUTPATIENT', 'DENTAL', 'LIFE', 'OPTICAL', 'TRAVEL_INSURANCE', 'CHRONIC_OUT', 'EMERGENCY', 'MATERNITY'],
            hasMaternityExtraArgs: false
        }
    }

    return requirements[tpaCode] || {
        requiresPhone: true,
        requiresDoctorName: false,
        requiresPayerName: false,
        requiresName: false,
        supportedIdTypes: ['EMIRATESID', 'CARDNUMBER'],
        supportedVisitTypes: ['OUTPATIENT'],
        hasMaternityExtraArgs: false
    }
}

