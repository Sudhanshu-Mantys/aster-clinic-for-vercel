/**
 * Mantys API Type Definitions
 * Contains all type definitions for Mantys TPA eligibility checks
 */

// ============================================================================
// REQUEST TYPES
// ============================================================================

export type TPACode =
    | "TPA001" // Neuron
    | "TPA002" // NextCare
    | "TPA003" // Al Madallah
    | "TPA004" // NAS
    | "TPA008" // Inayah
    | "TPA010" // FMC (First Med)
    | "TPA013" // Penta
    | "TPA016" // MSH
    | "TPA021" // Vidal
    | "TPA023" // Daman Thiqa
    | "TPA025" // Sehteq
    | "TPA026" // Aafiya
    | "TPA027" // Starwell
    | "TPA029" // eCare
    | "TPA030" // Iris
    | "TPA032" // Whealth
    | "TPA036" // Mednet
    | "TPA037" // Lifeline (Khat Al Haya)
    | "TPA038" // Enet
    | "INS005" // Dubai Insurance
    | "INS010" // AXA Gulf Insurance
    | "INS012" // Oman Insurance / Sukoon
    | "INS013" // Metlife
    | "INS015" // Saico
    | "INS017" // ADNIC
    | "INS020" // Al Buhaira
    | "INS026" // Daman
    | "INS028" // Interglobal
    | "INS029" // Al Dhafra
    | "INS038" // NGI (National General)
    | "INS041" // Fidelity
    | "INS044" // National Life
    | "INS053" // Allianz
    | "D004" // Daman (Variant)
    | "DHPO" // DHPO - Dubai Health Insurance
    | "RIYATI" // RIYATI
    | "BOTH" // All Insurance Providers

export type IDType = "EMIRATESID" | "CARDNUMBER" | "DHAMEMBERID" | "POLICYNUMBER" | "Passport"

export type VisitType =
    | "OUTPATIENT"
    | "INPATIENT"
    | "DENTAL"
    | "OPTICAL"
    | "MATERNITY"
    | "PSYCHIATRY"
    | "WELLNESS"
    | "CHRONIC_OUT"
    | "EMERGENCY"
    | "LIFE"
    | "TRAVEL_INSURANCE"

export interface MantysEligibilityRequest {
    id_value: string
    id_type: IDType
    tpa_name: TPACode
    visit_type: VisitType
    extra_args?: Record<string, any>
    doctorName?: string
    payerName?: string
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface NetworkInfo {
    network: string
    visit_type: string
    network_value: string
    matched_plan_name: string | null
    network_name_as_in_text: string
}

export interface CopayValues {
    copay: string
    deductible: string
    should_set_copay: boolean
    _maxDeductible?: string
}

export interface CopayDetailsToFill {
    name: "Outpatient" | "Maternity" | "Specialization" | "Inpatient"
    values_to_fill: {
        LAB: CopayValues
        MEDICINES: CopayValues
        PROCEDURE: CopayValues
        RADIOLOGY: CopayValues
        CONSULTATION: CopayValues
        "DENTAL CONSULTATION & PROCEDURE": CopayValues
    }
    primary_network: {
        network: string
        network_status: string | null
        matched_plan_name: string | null
    }
    available_networks: NetworkInfo[]
    has_multiple_networks: boolean
}

export interface PatientInfo {
    patient_id_info: {
        client_number: string
        dha_member_id: string | null
        policy_number: string
        tpa_member_id: string
        reference_number: string
        member_id?: string
    }
    policy_holder_dob: string
    policy_holder_name: string
    patient_emirates_id: string
    policy_holder_phone: string | null
    policy_holder_gender: string
    policy_primary_member_id: string
    policy_holder_relationship: string | null
    policy_holder_date_of_birth: string
    policy_primary_dha_member_id: string
    policy_id?: string | null
    payer_id?: string | null
    tpa_id?: string | null
    plan_name?: string | null
    insurance_mapping_id?: string | null
}

export interface PolicyNetwork {
    is_vip: string
    payer_name: string
    sponsor_id: string
    start_date: string
    valid_upto: string
    all_networks: NetworkInfo[]
    package_name: string | null
    is_gatekeeper: string
    waiting_period: string | null
    policy_authority: string
    policy_plan_name: string | null
    work_site_covered: string
    policy_holder_name: string | null
    payer_name_citation: string
    gatekeeper_citations: string
    payer_name_as_in_text: string
    policy_authority_citation: string
    work_site_covered_citations: string | null
    network_id?: string | null
}

export interface Benefit {
    [key: string]: any
}

export interface PolicyInfo {
    waiting_period: string
    policy_period_end: {
        DD: number
        MM: number
        YYYY: number
    }
    policy_jurisdiction: string
    policy_period_start: {
        DD: number
        MM: number
        YYYY: number
    }
    beneficiary_start_date: string | null
}

export interface CopayAnalysis {
    copay_details: any[]
    waiting_period: string
    special_remarks: string[]
    new_version_of_copay_analysis: {
        benefits: Benefit[]
        policy_info: PolicyInfo
        general_remarks: string[]
        abbreviations_defined: any
    }
}

export interface ReferralDocument {
    id?: string
    tag: string
    s3_url: string
}

export interface MantysResponseData {
    payer_id: string
    is_eligible: boolean
    job_task_id: string
    patient_info: PatientInfo
    copay_analysis: CopayAnalysis
    failure_reason: string | null
    policy_network: PolicyNetwork
    screenshot_key: string
    warning_messages: string[]
    policy_holder_dob: string
    policy_holder_name: string
    referral_documents: ReferralDocument[]
    copay_details_to_fill: CopayDetailsToFill[]
    policy_holder_emirates_id: string
    was_identified_by_aggregator: boolean
    policy_start_date?: string | null
    policy_end_date?: string | null
}

// Create Task Response
export interface MantysCreateTaskResponse {
    success: boolean
    message: string
    data: {
        task_id: string
        status: string
        organization_api_task_db?: {
            task_id_in_db: string
            task_id_in_celery: string
            status: string
        }
    }
}

// Task Result Response
export interface MantysTaskResultResponse {
    task_id: string
    status: string  // Can be "EXTRACTING_DATA", "PROCESS_COMPLETE", "IN_QUEUE", etc.
    interim_results?: {
        tpa_name: string
        screenshot_key: string
        referral_documents: Array<{
            id: string
            tag: string
            s3_url: string
        }>
    }
    eligibility_result?: {
        search_id: string
        data_dump: {
            tpa: string
            data: MantysResponseData
            status: string
            job_task_id: string
            message?: string
            error_type?: string
            screenshot_key?: string
        }
        task_id: string
        status: string
        clinic_id: string
        updated_at: string
        id: string
        tpa_name: string | null
        user_id: string
        tenant_id: string
        created_at: string
    }
    clinic_id?: string | null
    updated_at?: string
    id?: string
    request_dump?: any
    tenant_id?: string | null
    created_at?: string
}

// For backward compatibility with existing components
export interface MantysEligibilityResponse {
    tpa: string
    data: MantysResponseData
    status: "found" | "not_found" | "error"
    job_task_id: string
    task_id?: string
}

// ============================================================================
// CLINIC CONFIGURATION
// ============================================================================

export const CLINIC_IDS = {
    ASTER: "92d5da39-36af-4fa2-bde3-3828600d7871"
} as const

export type ClinicCode = keyof typeof CLINIC_IDS

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface MantysError {
    error: string
    details?: any
}

// Extract key fields helper
export interface MantysKeyFields {
    network: string | null // From data.policy_network.all_networks[0].network
    copayDetails: CopayDetailsToFill[]
    memberId: string // From data.patient_info.policy_primary_member_id
    isEligible: boolean
    policyStartDate: string
    policyEndDate: string
    payerName: string
    specialRemarks: string[]
    referralDocuments: ReferralDocument[]
}
