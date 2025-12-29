/**
 * Redis-based Configuration Store
 * Replaces in-memory storage with Redis persistence
 */

import { getRedisClient } from './redis-client'

// Redis key prefixes
const REDIS_KEYS = {
    CLINIC_CONFIG: 'clinic:config',
    TPA_CONFIG: 'clinic:tpa',
    PLAN_CONFIG: 'clinic:plan',
    NETWORK_CONFIG: 'clinic:network',
    DOCTOR_CONFIG: 'clinic:doctor',
    VALUE_MAPPINGS: 'clinic:mappings',
    SPECIALISATION_CONFIG: 'clinic:specialisation'
}

// Helper to generate ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// Clinic Configuration
// ============================================================================

export async function getClinicConfig(clinicId: string): Promise<any> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.CLINIC_CONFIG}:${clinicId}`
        const data = await redis.get(key)
        return data ? JSON.parse(data) : null
    } catch (error) {
        console.error('Error getting clinic config from Redis:', error)
        return null
    }
}

export async function setClinicConfig(clinicId: string, config: any): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.CLINIC_CONFIG}:${clinicId}`
        await redis.set(key, JSON.stringify({
            ...config,
            clinic_id: clinicId,
            updated_at: new Date().toISOString()
        }))
    } catch (error) {
        console.error('Error setting clinic config in Redis:', error)
        throw error
    }
}

// ============================================================================
// TPA Configurations (unified - stores both config and mapping data)
// Uses ins_code as the primary identifier for Lifetrenz API lookups
// ============================================================================

export interface TPAMapping {
    hospital_insurance_mapping_id: number
    insurance_id: number
    insurance_type: number // 1 = Insurance, 2 = TPA
    insurance_name: string
    ins_payer: string | null
    ins_code: string // e.g., "TPA036", "INS026", "DHA" - used as key identifier
    clinic_id?: string
    created_at?: string
    updated_at?: string
}

export interface ExtraFormField {
    field: 'doctor' | 'phoneNumber' | 'name'
    required: boolean // true = compulsory, false = optional
}

export interface TPAConfig {
    // Mapping data (from API)
    hospital_insurance_mapping_id?: number
    insurance_id?: number
    insurance_type?: number
    insurance_name?: string
    ins_payer?: string | null
    ins_code: string // Primary identifier

    // Config data (optional - for API URLs, credentials, etc.)
    tpa_id?: string
    tpa_name?: string
    api_url?: string
    credentials?: string
    config_data?: any

    // Lifetrenz (LT) values
    lt_site_id?: string
    lt_customer_id?: string
    lt_hospital_id?: string
    lt_other_config?: Record<string, any>

    // Extra form fields configuration
    extra_form_fields?: ExtraFormField[]

    clinic_id?: string
    created_at?: string
    updated_at?: string
}

export interface ValidationResult {
    isValid: boolean
    missingFields: string[]
    warnings: string[]
    errors: string[]
}

/**
 * Validate TPA config for required mapping fields
 * Returns validation result with missing fields and warnings
 */
export function validateTPAConfig(config: TPAConfig, requireMapping: boolean = false): ValidationResult {
    const missingFields: string[] = []
    const warnings: string[] = []
    const errors: string[] = []

    // Always require ins_code
    if (!config.ins_code && !config.tpa_id) {
        errors.push('Either ins_code or tpa_id is required')
    }

    // If mapping is required (for eligibility checks), validate mapping fields
    if (requireMapping) {
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
    }

    // Warnings for optional but recommended fields
    if (!config.ins_payer) {
        warnings.push('ins_payer is missing (optional but recommended)')
    }

    // If config has tpa_name but no insurance_name, that's a warning
    if (config.tpa_name && !config.insurance_name && requireMapping) {
        warnings.push('tpa_name exists but insurance_name is missing (insurance_name is preferred)')
    }

    return {
        isValid: errors.length === 0 && missingFields.length === 0,
        missingFields,
        warnings,
        errors
    }
}

/**
 * Get all TPA configs for a clinic
 */
export async function getTPAConfigs(clinicId: string): Promise<TPAConfig[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:*`

        // Test connection first
        try {
            await redis.ping()
        } catch (pingError) {
            console.error('Redis ping failed in getTPAConfigs:', pingError)
            throw new Error(`Redis connection failed: ${pingError instanceof Error ? pingError.message : String(pingError)}`)
        }

        const keys = await redis.keys(pattern)

        // Filter out index keys
        const configKeys = keys.filter(key => !key.endsWith(':index'))

        if (configKeys.length === 0) {
            console.warn(`No TPA config keys found for clinic ${clinicId} with pattern ${pattern}`)
            return []
        }

        const configs = await Promise.all(
            configKeys.map(async (key) => {
                try {
                    const data = await redis.get(key)
                    return data ? JSON.parse(data) : null
                } catch (parseError) {
                    console.error(`Error parsing config from key ${key}:`, parseError)
                    return null
                }
            })
        )

        const validConfigs = configs.filter(Boolean)
        if (validConfigs.length === 0 && configKeys.length > 0) {
            console.warn(`Found ${configKeys.length} keys but all failed to parse for clinic ${clinicId}`)
        }

        return validConfigs
    } catch (error) {
        console.error('Error getting TPA configs from Redis:', error)
        console.error('Error details:', {
            clinicId,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
        })
        throw error // Re-throw to surface connection issues
    }
}

/**
 * Get TPA config by ins_code (primary lookup method for Lifetrenz API)
 */
export async function getTPAConfigByCode(clinicId: string, insCode: string): Promise<TPAConfig | null> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:${insCode}`

        // Test connection first
        try {
            await redis.ping()
        } catch (pingError) {
            console.error('Redis ping failed in getTPAConfigByCode:', pingError)
            throw new Error(`Redis connection failed: ${pingError instanceof Error ? pingError.message : String(pingError)}`)
        }

        const data = await redis.get(key)

        if (!data) {
            console.warn(`No TPA config found for key: ${key} (clinicId: ${clinicId}, insCode: ${insCode})`)
            return null
        }

        try {
            return JSON.parse(data)
        } catch (parseError) {
            console.error(`Error parsing TPA config from key ${key}:`, parseError)
            return null
        }
    } catch (error) {
        console.error('Error getting TPA config by code from Redis:', error)
        console.error('Error details:', {
            clinicId,
            insCode,
            key: `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:${insCode}`,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
        })
        throw error // Re-throw to surface connection issues
    }
}

/**
 * Get TPA config by tpa_id (legacy support)
 */
export async function getTPAConfig(clinicId: string, tpaId: string): Promise<TPAConfig | null> {
    try {
        // Try to find by tpa_id in all configs
        const configs = await getTPAConfigs(clinicId)
        return configs.find(c => c.tpa_id === tpaId || c.ins_code === tpaId) || null
    } catch (error) {
        console.error('Error getting TPA config from Redis:', error)
        return null
    }
}

/**
 * Set TPA config (uses ins_code as key if available, otherwise uses tpa_id)
 * Validates config before saving and warns about missing mapping fields
 */
export async function setTPAConfig(clinicId: string, config: TPAConfig, options?: { skipValidation?: boolean }): Promise<void> {
    try {
        // Validate config unless explicitly skipped
        if (!options?.skipValidation) {
            const validation = validateTPAConfig(config, false)
            if (validation.errors.length > 0) {
                throw new Error(`TPA config validation failed: ${validation.errors.join(', ')}`)
            }
            if (validation.missingFields.length > 0) {
                console.warn(`TPA config for ${config.ins_code || config.tpa_id || 'unknown'} is missing mapping fields: ${validation.missingFields.join(', ')}`)
            }
            if (validation.warnings.length > 0) {
                console.warn(`TPA config warnings for ${config.ins_code || config.tpa_id || 'unknown'}: ${validation.warnings.join(', ')}`)
            }
        }

        const redis = await getRedisClient()

        // Use ins_code as primary key, fallback to tpa_id
        const keyId = config.ins_code || config.tpa_id
        if (!keyId) {
            throw new Error('Either ins_code or tpa_id is required')
        }

        const key = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:${keyId}`
        const indexKey = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:index`

        const configData: TPAConfig = {
            ...config,
            clinic_id: clinicId,
            updated_at: new Date().toISOString(),
            created_at: config.created_at || new Date().toISOString()
        }

        await redis.set(key, JSON.stringify(configData))

        // Add to index set for quick lookup
        if (config.ins_code) {
            await redis.sadd(indexKey, config.ins_code)
        }
    } catch (error) {
        console.error('Error setting TPA config in Redis:', error)
        throw error
    }
}

/**
 * Delete TPA config by ins_code or tpa_id
 */
export async function deleteTPAConfig(clinicId: string, identifier: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:${identifier}`
        const indexKey = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:index`

        await redis.del(key)
        await redis.srem(indexKey, identifier)
    } catch (error) {
        console.error('Error deleting TPA config from Redis:', error)
        throw error
    }
}

/**
 * Get TPA mapping by ins_code (alias for getTPAConfigByCode for backward compatibility)
 * This is used to get insurance_id and insurance_type before making Lifetrenz API calls
 */
export async function getTPAMappingByCode(clinicId: string, insCode: string): Promise<TPAMapping | null> {
    const config = await getTPAConfigByCode(clinicId, insCode)
    if (!config) return null

    return {
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
}

/**
 * Store TPA mapping (uses ins_code as key)
 */
export async function setTPAMapping(clinicId: string, mapping: TPAMapping): Promise<void> {
    await setTPAConfig(clinicId, mapping as TPAConfig)
}

/**
 * Bulk import TPA mappings from API response
 * Validates each mapping before importing
 */
export async function bulkImportTPAMappings(clinicId: string, mappings: TPAMapping[]): Promise<{ imported: number; errors: number; validationErrors: number }> {
    let imported = 0
    let errors = 0
    let validationErrors = 0

    try {
        const redis = await getRedisClient()
        const pipeline = redis.pipeline()
        const indexKey = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:index`

        // Clear existing index
        await redis.del(indexKey)

        for (const mapping of mappings) {
            try {
                if (!mapping.ins_code) {
                    console.warn('Skipping mapping without ins_code:', mapping)
                    errors++
                    continue
                }

                // Validate mapping (require mapping fields for bulk import)
                const validation = validateTPAConfig(mapping as TPAConfig, true)
                if (!validation.isValid) {
                    console.error(`Skipping invalid mapping for ${mapping.ins_code}:`, {
                        missingFields: validation.missingFields,
                        errors: validation.errors
                    })
                    validationErrors++
                    errors++
                    continue
                }

                if (validation.warnings.length > 0) {
                    console.warn(`Mapping warnings for ${mapping.ins_code}:`, validation.warnings)
                }

                const key = `${REDIS_KEYS.TPA_CONFIG}:${clinicId}:${mapping.ins_code}`
                const configData: TPAConfig = {
                    ...mapping,
                    clinic_id: clinicId,
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                }

                pipeline.set(key, JSON.stringify(configData))
                pipeline.sadd(indexKey, mapping.ins_code)
                imported++
            } catch (error) {
                console.error('Error processing mapping:', mapping, error)
                errors++
            }
        }

        await pipeline.exec()
        return { imported, errors, validationErrors }
    } catch (error) {
        console.error('Error bulk importing TPA mappings:', error)
        throw error
    }
}

/**
 * Get all TPA mappings for a clinic (returns only mapping data)
 */
export async function getAllTPAMappings(clinicId: string): Promise<TPAMapping[]> {
    try {
        const configs = await getTPAConfigs(clinicId)
        return configs
            .filter(c => c.ins_code && c.insurance_id !== undefined)
            .map(c => ({
                hospital_insurance_mapping_id: c.hospital_insurance_mapping_id!,
                insurance_id: c.insurance_id!,
                insurance_type: c.insurance_type!,
                insurance_name: c.insurance_name!,
                ins_payer: c.ins_payer || null,
                ins_code: c.ins_code,
                clinic_id: c.clinic_id,
                created_at: c.created_at,
                updated_at: c.updated_at
            }))
    } catch (error) {
        console.error('Error getting all TPA mappings from Redis:', error)
        return []
    }
}

/**
 * Delete TPA mapping by ins_code
 */
export async function deleteTPAMapping(clinicId: string, insCode: string): Promise<void> {
    await deleteTPAConfig(clinicId, insCode)
}

// ============================================================================
// Plan Configurations
// ============================================================================

export async function getPlanConfigs(clinicId: string): Promise<any[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `${REDIS_KEYS.PLAN_CONFIG}:${clinicId}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const configs = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return configs.filter(Boolean)
    } catch (error) {
        console.error('Error getting plan configs from Redis:', error)
        return []
    }
}

export async function setPlanConfig(clinicId: string, planId: string, config: any): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.PLAN_CONFIG}:${clinicId}:${planId}`
        await redis.set(key, JSON.stringify({
            ...config,
            clinic_id: clinicId,
            plan_id: planId,
            updated_at: new Date().toISOString()
        }))
    } catch (error) {
        console.error('Error setting plan config in Redis:', error)
        throw error
    }
}

export async function deletePlanConfig(clinicId: string, planId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.PLAN_CONFIG}:${clinicId}:${planId}`
        await redis.del(key)
    } catch (error) {
        console.error('Error deleting plan config from Redis:', error)
        throw error
    }
}

// ============================================================================
// Network Configurations
// ============================================================================

export async function getNetworkConfigs(clinicId: string): Promise<any[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `${REDIS_KEYS.NETWORK_CONFIG}:${clinicId}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const configs = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return configs.filter(Boolean)
    } catch (error) {
        console.error('Error getting network configs from Redis:', error)
        return []
    }
}

export async function setNetworkConfig(clinicId: string, networkId: string, config: any): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.NETWORK_CONFIG}:${clinicId}:${networkId}`
        await redis.set(key, JSON.stringify({
            ...config,
            clinic_id: clinicId,
            network_id: networkId,
            updated_at: new Date().toISOString()
        }))
    } catch (error) {
        console.error('Error setting network config in Redis:', error)
        throw error
    }
}

export async function deleteNetworkConfig(clinicId: string, networkId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.NETWORK_CONFIG}:${clinicId}:${networkId}`
        await redis.del(key)
    } catch (error) {
        console.error('Error deleting network config from Redis:', error)
        throw error
    }
}

// ============================================================================
// Doctor Configurations
// ============================================================================

export async function getDoctorConfigs(clinicId: string): Promise<any[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `${REDIS_KEYS.DOCTOR_CONFIG}:${clinicId}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const configs = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return configs.filter(Boolean)
    } catch (error) {
        console.error('Error getting doctor configs from Redis:', error)
        return []
    }
}

export async function setDoctorConfig(clinicId: string, doctorId: string, config: any): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.DOCTOR_CONFIG}:${clinicId}:${doctorId}`
        await redis.set(key, JSON.stringify({
            ...config,
            clinic_id: clinicId,
            doctor_id: doctorId,
            updated_at: new Date().toISOString()
        }))
    } catch (error) {
        console.error('Error setting doctor config in Redis:', error)
        throw error
    }
}

export async function deleteDoctorConfig(clinicId: string, doctorId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.DOCTOR_CONFIG}:${clinicId}:${doctorId}`
        await redis.del(key)
    } catch (error) {
        console.error('Error deleting doctor config from Redis:', error)
        throw error
    }
}

// ============================================================================
// Value Mappings (from original /api/mappings)
// ============================================================================

export async function getValueMappings(clinicId: string): Promise<any[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `${REDIS_KEYS.VALUE_MAPPINGS}:${clinicId}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const mappings = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return mappings.filter(Boolean)
    } catch (error) {
        console.error('Error getting value mappings from Redis:', error)
        return []
    }
}

export async function setValueMapping(clinicId: string, mappingId: string, mapping: any): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.VALUE_MAPPINGS}:${clinicId}:${mappingId}`
        await redis.set(key, JSON.stringify({
            ...mapping,
            clinic_id: clinicId,
            id: mappingId,
            updated_at: new Date().toISOString()
        }))
    } catch (error) {
        console.error('Error setting value mapping in Redis:', error)
        throw error
    }
}

export async function deleteValueMapping(clinicId: string, mappingId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.VALUE_MAPPINGS}:${clinicId}:${mappingId}`
        await redis.del(key)
    } catch (error) {
        console.error('Error deleting value mapping from Redis:', error)
        throw error
    }
}

export async function getValueMappingById(mappingId: string): Promise<{ clinicId: string; mapping: any } | null> {
    try {
        const redis = await getRedisClient()
        // Search across all clinics for this mapping ID
        const pattern = `${REDIS_KEYS.VALUE_MAPPINGS}:*:${mappingId}`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return null
        }

        const key = keys[0] // Should only be one match
        const data = await redis.get(key)
        if (!data) {
            return null
        }

        // Extract clinic_id from key: clinic:mappings:CLINIC_ID:MAPPING_ID
        const parts = key.split(':')
        const clinicId = parts[2]

        return {
            clinicId,
            mapping: JSON.parse(data)
        }
    } catch (error) {
        console.error('Error getting value mapping by ID from Redis:', error)
        return null
    }
}

// ============================================================================
// Specialisations Mapping (Global - not clinic-specific)
// ============================================================================

export async function getSpecialisationsMapping(): Promise<Record<string, string>> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.SPECIALISATION_CONFIG}:mapping`
        const data = await redis.get(key)
        return data ? JSON.parse(data) : {}
    } catch (error) {
        console.error('Error getting specialisations mapping from Redis:', error)
        return {}
    }
}

export async function setSpecialisationsMapping(mapping: Record<string, string>): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `${REDIS_KEYS.SPECIALISATION_CONFIG}:mapping`
        await redis.set(key, JSON.stringify(mapping))
    } catch (error) {
        console.error('Error setting specialisations mapping in Redis:', error)
        throw error
    }
}

export async function getSpecialisationName(specialisationId: string | number): Promise<string | null> {
    try {
        const mapping = await getSpecialisationsMapping()
        return mapping[String(specialisationId)] || null
    } catch (error) {
        console.error('Error getting specialisation name:', error)
        return null
    }
}

// ============================================================================
// Payer Configurations (TPA-wise)
// Each TPA has a list of LTPayers
// ============================================================================

export interface LTPayer {
    ins_tpaid: number
    ins_tpa_name: string
    ins_tpa_code: string
    ins_tpa_type: number
    reciver_payer_map_id: number
    reciever_payer_id: number
    clinic_id?: string
    tpa_ins_code?: string // The TPA's ins_code this payer belongs to
    created_at?: string
    updated_at?: string
}

/**
 * Get all payers for a specific TPA
 */
export async function getPayersByTPA(clinicId: string, tpaInsCode: string): Promise<LTPayer[]> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:payer:${clinicId}:${tpaInsCode}`
        const data = await redis.get(key)
        return data ? JSON.parse(data) : []
    } catch (error) {
        console.error('Error getting payers by TPA from Redis:', error)
        return []
    }
}

/**
 * Set payers for a specific TPA
 */
export async function setPayersByTPA(clinicId: string, tpaInsCode: string, payers: LTPayer[]): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:payer:${clinicId}:${tpaInsCode}`

        // Add metadata to each payer
        const payersWithMetadata = payers.map(payer => ({
            ...payer,
            clinic_id: clinicId,
            tpa_ins_code: tpaInsCode,
            updated_at: new Date().toISOString(),
            created_at: payer.created_at || new Date().toISOString()
        }))

        await redis.set(key, JSON.stringify(payersWithMetadata))

        // Add to TPA index
        const indexKey = `clinic:payer:${clinicId}:index`
        await redis.sadd(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error setting payers by TPA in Redis:', error)
        throw error
    }
}

/**
 * Get all TPAs that have payers configured
 */
export async function getTPAsWithPayers(clinicId: string): Promise<string[]> {
    try {
        const redis = await getRedisClient()
        const indexKey = `clinic:payer:${clinicId}:index`
        const tpaCodes = await redis.smembers(indexKey)
        return tpaCodes || []
    } catch (error) {
        console.error('Error getting TPAs with payers from Redis:', error)
        return []
    }
}

/**
 * Delete all payers for a specific TPA
 */
export async function deletePayersByTPA(clinicId: string, tpaInsCode: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:payer:${clinicId}:${tpaInsCode}`
        const indexKey = `clinic:payer:${clinicId}:index`

        await redis.del(key)
        await redis.srem(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error deleting payers by TPA from Redis:', error)
        throw error
    }
}

// ============================================================================
// LT Plan Configurations (TPA-wise)
// Each TPA has a list of LT Plans fetched from Lifetrenz API
// ============================================================================

export interface LTPlan {
    plan_id: number
    insurance_mapping_id: number
    plan_no: string | null
    insurance_plan_name: string
    plan_code: string
    insurance_name: string
    auth_expiry_in_days: number
    authorization_limit: string
    contract_name: string
    cm_contract_id: number
    priority_patient_applicable: number
    refer_ltr_reqired_type: string | null
    is_nw_emp_exclude_exist: number
    is_network_deactivated: string
    type_name: string
    class_name: string
    has_top_up: number
    clinic_id?: string
    tpa_ins_code?: string // The TPA's ins_code this plan belongs to
    created_at?: string
    updated_at?: string
}

/**
 * Get all LT plans for a specific TPA
 */
export async function getPlansByTPA(clinicId: string, tpaInsCode: string): Promise<LTPlan[]> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:plan:${clinicId}:${tpaInsCode}`
        const data = await redis.get(key)
        return data ? JSON.parse(data) : []
    } catch (error) {
        console.error('Error getting plans by TPA from Redis:', error)
        return []
    }
}

/**
 * Set LT plans for a specific TPA
 */
export async function setPlansByTPA(clinicId: string, tpaInsCode: string, plans: LTPlan[]): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:plan:${clinicId}:${tpaInsCode}`

        // Add metadata to each plan
        const plansWithMetadata = plans.map(plan => ({
            ...plan,
            clinic_id: clinicId,
            tpa_ins_code: tpaInsCode,
            updated_at: new Date().toISOString(),
            created_at: plan.created_at || new Date().toISOString()
        }))

        await redis.set(key, JSON.stringify(plansWithMetadata))

        // Add to TPA index
        const indexKey = `clinic:plan:${clinicId}:index`
        await redis.sadd(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error setting plans by TPA in Redis:', error)
        throw error
    }
}

/**
 * Get all TPAs that have LT plans configured
 */
export async function getTPAsWithPlans(clinicId: string): Promise<string[]> {
    try {
        const redis = await getRedisClient()
        const indexKey = `clinic:plan:${clinicId}:index`
        const tpaCodes = await redis.smembers(indexKey)
        return tpaCodes || []
    } catch (error) {
        console.error('Error getting TPAs with plans from Redis:', error)
        return []
    }
}

/**
 * Delete all LT plans for a specific TPA
 */
export async function deletePlansByTPA(clinicId: string, tpaInsCode: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:plan:${clinicId}:${tpaInsCode}`
        const indexKey = `clinic:plan:${clinicId}:index`

        await redis.del(key)
        await redis.srem(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error deleting plans by TPA from Redis:', error)
        throw error
    }
}

// ============================================================================
// Mantys Network Configurations (TPA-wise)
// Each TPA has a list of Mantys Networks (from hardcoded mapping)
// ============================================================================

export interface MantysNetwork {
    name: string
    tpa_ins_code: string // The TPA's ins_code this network belongs to
    clinic_id?: string
    created_at?: string
    updated_at?: string
}

/**
 * Get all Mantys networks for a specific TPA
 */
export async function getMantysNetworksByTPA(clinicId: string, tpaInsCode: string): Promise<MantysNetwork[]> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:mantys_network:${clinicId}:${tpaInsCode}`
        const data = await redis.get(key)
        return data ? JSON.parse(data) : []
    } catch (error) {
        console.error('Error getting Mantys networks by TPA from Redis:', error)
        return []
    }
}

/**
 * Set Mantys networks for a specific TPA
 */
export async function setMantysNetworksByTPA(clinicId: string, tpaInsCode: string, networks: MantysNetwork[]): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:mantys_network:${clinicId}:${tpaInsCode}`

        // Add metadata to each network
        const networksWithMetadata = networks.map(network => ({
            ...network,
            clinic_id: clinicId,
            tpa_ins_code: tpaInsCode,
            updated_at: new Date().toISOString(),
            created_at: network.created_at || new Date().toISOString()
        }))

        await redis.set(key, JSON.stringify(networksWithMetadata))

        // Add to TPA index
        const indexKey = `clinic:mantys_network:${clinicId}:index`
        await redis.sadd(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error setting Mantys networks by TPA in Redis:', error)
        throw error
    }
}

/**
 * Get all TPAs that have Mantys networks configured
 */
export async function getTPAsWithMantysNetworks(clinicId: string): Promise<string[]> {
    try {
        const redis = await getRedisClient()
        const indexKey = `clinic:mantys_network:${clinicId}:index`
        const tpaCodes = await redis.smembers(indexKey)
        return tpaCodes || []
    } catch (error) {
        console.error('Error getting TPAs with Mantys networks from Redis:', error)
        return []
    }
}

/**
 * Delete all Mantys networks for a specific TPA
 */
export async function deleteMantysNetworksByTPA(clinicId: string, tpaInsCode: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:mantys_network:${clinicId}:${tpaInsCode}`
        const indexKey = `clinic:mantys_network:${clinicId}:index`

        await redis.del(key)
        await redis.srem(indexKey, tpaInsCode)
    } catch (error) {
        console.error('Error deleting Mantys networks by TPA from Redis:', error)
        throw error
    }
}

// ============================================================================
// Plan-Network Mappings
// Maps LT Plans to Mantys Networks for each TPA
// ============================================================================

export interface PlanNetworkMapping {
    id: string // Generated ID for the mapping
    clinic_id: string
    tpa_ins_code: string
    lt_plan_id: number // LT plan_id
    lt_plan_name: string
    lt_plan_code: string
    mantys_network_name: string
    is_default?: boolean // Whether this is the default mapping for this plan
    created_at?: string
    updated_at?: string
}

/**
 * Get all plan-network mappings for a specific TPA
 */
export async function getPlanMappingsByTPA(clinicId: string, tpaInsCode: string): Promise<PlanNetworkMapping[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const mappings = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return mappings.filter(Boolean)
    } catch (error) {
        console.error('Error getting plan mappings by TPA from Redis:', error)
        return []
    }
}

/**
 * Get all plan-network mappings for a clinic (across all TPAs)
 */
export async function getAllPlanMappings(clinicId: string): Promise<PlanNetworkMapping[]> {
    try {
        const redis = await getRedisClient()
        const pattern = `clinic:plan_mapping:${clinicId}:*`
        const keys = await redis.keys(pattern)

        if (keys.length === 0) {
            return []
        }

        const mappings = await Promise.all(
            keys.map(async (key) => {
                const data = await redis.get(key)
                return data ? JSON.parse(data) : null
            })
        )

        return mappings.filter(Boolean)
    } catch (error) {
        console.error('Error getting all plan mappings from Redis:', error)
        return []
    }
}

/**
 * Set a plan-network mapping
 */
export async function setPlanMapping(clinicId: string, mapping: PlanNetworkMapping): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:plan_mapping:${clinicId}:${mapping.tpa_ins_code}:${mapping.id}`

        const mappingData: PlanNetworkMapping = {
            ...mapping,
            clinic_id: clinicId,
            updated_at: new Date().toISOString(),
            created_at: mapping.created_at || new Date().toISOString()
        }

        await redis.set(key, JSON.stringify(mappingData))
    } catch (error) {
        console.error('Error setting plan mapping in Redis:', error)
        throw error
    }
}

/**
 * Delete a plan-network mapping
 */
export async function deletePlanMapping(clinicId: string, tpaInsCode: string, mappingId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const key = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:${mappingId}`
        await redis.del(key)
    } catch (error) {
        console.error('Error deleting plan mapping from Redis:', error)
        throw error
    }
}

/**
 * Set default mapping for a Mantys network (unset other defaults for the same network)
 * Only one default mapping is allowed per Mantys network
 */
export async function setDefaultMapping(clinicId: string, tpaInsCode: string, mappingId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const mappingKey = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:${mappingId}`
        const mappingData = await redis.get(mappingKey)

        if (!mappingData) {
            throw new Error('Mapping not found')
        }

        const mapping: PlanNetworkMapping = JSON.parse(mappingData)

        // Get all mappings for this TPA
        const allMappings = await getPlanMappingsByTPA(clinicId, tpaInsCode)

        // Unset defaults for the same Mantys network (only one default per network)
        const pipeline = redis.pipeline()
        for (const m of allMappings) {
            if (m.mantys_network_name === mapping.mantys_network_name && m.id !== mappingId && m.is_default) {
                const key = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:${m.id}`
                const updated = { ...m, is_default: false, updated_at: new Date().toISOString() }
                pipeline.set(key, JSON.stringify(updated))
            }
        }

        // Set this mapping as default
        const updated = { ...mapping, is_default: true, updated_at: new Date().toISOString() }
        pipeline.set(mappingKey, JSON.stringify(updated))

        await pipeline.exec()
    } catch (error) {
        console.error('Error setting default mapping:', error)
        throw error
    }
}

/**
 * Unset default mapping for a Mantys network
 */
export async function unsetDefaultMapping(clinicId: string, tpaInsCode: string, mappingId: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        const mappingKey = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:${mappingId}`
        const mappingData = await redis.get(mappingKey)

        if (!mappingData) {
            throw new Error('Mapping not found')
        }

        const mapping: PlanNetworkMapping = JSON.parse(mappingData)

        // Unset this mapping's default status
        const updated = { ...mapping, is_default: false, updated_at: new Date().toISOString() }
        await redis.set(mappingKey, JSON.stringify(updated))
    } catch (error) {
        console.error('Error unsetting default mapping:', error)
        throw error
    }
}

/**
 * Bulk import mappings
 * Ensures only one default per Mantys network
 */
export async function bulkImportMappings(clinicId: string, mappings: PlanNetworkMapping[]): Promise<{ imported: number; errors: number; defaults_fixed: number }> {
    let imported = 0
    let errors = 0
    let defaultsFixed = 0

    try {
        const redis = await getRedisClient()

        // First, validate and normalize mappings
        const validMappings: PlanNetworkMapping[] = []
        for (const mapping of mappings) {
            try {
                if (!mapping.tpa_ins_code || !mapping.lt_plan_id || !mapping.mantys_network_name) {
                    errors++
                    continue
                }

                const id = mapping.id || generateId()
                validMappings.push({
                    ...mapping,
                    id,
                    clinic_id: clinicId,
                    updated_at: new Date().toISOString(),
                    created_at: mapping.created_at || new Date().toISOString()
                })
            } catch (error) {
                console.error('Error processing mapping:', mapping, error)
                errors++
            }
        }

        // Group by TPA and network to enforce one default per network
        const networkDefaults: Record<string, PlanNetworkMapping[]> = {}
        for (const mapping of validMappings) {
            if (mapping.is_default) {
                const key = `${mapping.tpa_ins_code}:${mapping.mantys_network_name}`
                if (!networkDefaults[key]) {
                    networkDefaults[key] = []
                }
                networkDefaults[key].push(mapping)
            }
        }

        // For each network with multiple defaults, keep only the first one
        for (const key in networkDefaults) {
            const defaults = networkDefaults[key]
            if (defaults.length > 1) {
                // Keep the first one, unset the rest
                for (let i = 1; i < defaults.length; i++) {
                    defaults[i].is_default = false
                    defaultsFixed++
                }
            }
        }

        // Import all mappings
        const pipeline = redis.pipeline()
        for (const mapping of validMappings) {
            const key = `clinic:plan_mapping:${clinicId}:${mapping.tpa_ins_code}:${mapping.id}`
            pipeline.set(key, JSON.stringify(mapping))
            imported++
        }

        await pipeline.exec()

        // Final cleanup: check existing mappings in database and ensure no network has multiple defaults
        // Group new mappings by TPA and network to see which networks will have new defaults
        const newDefaultsByNetwork: Record<string, PlanNetworkMapping> = {}
        for (const mapping of validMappings) {
            if (mapping.is_default) {
                const key = `${mapping.tpa_ins_code}:${mapping.mantys_network_name}`
                // Keep the first default we encounter for each network
                if (!newDefaultsByNetwork[key]) {
                    newDefaultsByNetwork[key] = mapping
                }
            }
        }

        // For each TPA that has new defaults, check existing mappings and unset conflicting defaults
        const tpaSet = new Set(validMappings.map(m => m.tpa_ins_code))
        const cleanupPipeline = redis.pipeline()
        let cleanupNeeded = false

        for (const tpaInsCode of Array.from(tpaSet)) {
            // Get all existing mappings for this TPA
            const existingMappings = await getPlanMappingsByTPA(clinicId, tpaInsCode)

            // For each network that will have a new default, unset existing defaults
            for (const key in newDefaultsByNetwork) {
                const [tpa, networkName] = key.split(':')
                if (tpa === tpaInsCode) {
                    const newDefault = newDefaultsByNetwork[key]
                    // Find existing defaults for this network (excluding the new one we just imported)
                    for (const existing of existingMappings) {
                        if (existing.mantys_network_name === networkName &&
                            existing.is_default &&
                            existing.id !== newDefault.id) {
                            const existingKey = `clinic:plan_mapping:${clinicId}:${tpaInsCode}:${existing.id}`
                            const updated = { ...existing, is_default: false, updated_at: new Date().toISOString() }
                            cleanupPipeline.set(existingKey, JSON.stringify(updated))
                            cleanupNeeded = true
                            defaultsFixed++
                        }
                    }
                }
            }
        }

        if (cleanupNeeded) {
            await cleanupPipeline.exec()
        }

        return { imported, errors, defaults_fixed: defaultsFixed }
    } catch (error) {
        console.error('Error bulk importing mappings:', error)
        throw error
    }
}

