/**
 * Clinic Configuration Utilities
 * Helper functions to access clinic-specific configurations and mappings
 */

export interface ClinicConfig {
    clinic_id: string
    clinic_name: string
    mantys_api_url?: string
    mantys_api_key?: string
    mantys_client_id?: string
    default_organization_id?: string
    aster_api_base_url?: string
    aster_api_username?: string
    aster_api_password?: string
    redis_url?: string
    liftrenz_api_url?: string
    liftrenz_api_key?: string
    updated_at?: string
}

export interface ValueMapping {
    id: string
    clinic_id: string
    mapping_type: string
    source_value: string
    target_value: string
    description?: string
    created_at: string
    updated_at: string
}

/**
 * Fetch clinic configuration
 */
export async function getClinicConfig(clinicId: string): Promise<ClinicConfig | null> {
    try {
        const response = await fetch(`/api/clinic-config?clinic_id=${clinicId}`)
        if (response.ok) {
            const data = await response.json()
            return data.config
        }
        return null
    } catch (error) {
        console.error('Failed to fetch clinic config:', error)
        return null
    }
}

/**
 * Fetch all mappings for a clinic
 */
export async function getClinicMappings(clinicId: string): Promise<ValueMapping[]> {
    try {
        const response = await fetch(`/api/mappings?clinic_id=${clinicId}`)
        if (response.ok) {
            const data = await response.json()
            return data.mappings || []
        }
        return []
    } catch (error) {
        console.error('Failed to fetch clinic mappings:', error)
        return []
    }
}

/**
 * Get a specific mapping by type and source value
 */
export async function getMappingValue(
    clinicId: string,
    mappingType: string,
    sourceValue: string
): Promise<string | null> {
    try {
        const mappings = await getClinicMappings(clinicId)
        const mapping = mappings.find(
            m => m.mapping_type === mappingType && m.source_value === sourceValue
        )
        return mapping?.target_value || null
    } catch (error) {
        console.error('Failed to get mapping value:', error)
        return null
    }
}

/**
 * Get all mappings of a specific type
 */
export async function getMappingsByType(
    clinicId: string,
    mappingType: string
): Promise<ValueMapping[]> {
    try {
        const mappings = await getClinicMappings(clinicId)
        return mappings.filter(m => m.mapping_type === mappingType)
    } catch (error) {
        console.error('Failed to get mappings by type:', error)
        return []
    }
}

/**
 * Create or update a mapping
 */
export async function saveMappingValue(
    clinicId: string,
    mappingType: string,
    sourceValue: string,
    targetValue: string,
    description?: string
): Promise<ValueMapping | null> {
    try {
        const response = await fetch('/api/mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clinic_id: clinicId,
                mapping_type: mappingType,
                source_value: sourceValue,
                target_value: targetValue,
                description
            })
        })
        if (response.ok) {
            const data = await response.json()
            return data.mapping
        }
        return null
    } catch (error) {
        console.error('Failed to save mapping:', error)
        return null
    }
}

/**
 * Mapping type constants
 */
export const MAPPING_TYPES = {
    PAYER_CODE: 'payerCode',
    PLAN_CODE: 'planCode',
    VISIT_TYPE: 'visitType',
    ID_TYPE: 'idType',
    TPA_CODE: 'tpaCode',
    OTHER: 'other'
} as const

export type MappingType = typeof MAPPING_TYPES[keyof typeof MAPPING_TYPES]

