/**
 * In-memory stores for internal configuration.
 *
 * NOTE: This is for local/dev and prototyping only.
 * In production, back this with a real database + proper authz.
 */

export type ISODateString = string

export interface ValueMapping {
    id: string
    clinic_id: string
    mapping_type: string
    source_value: string
    target_value: string
    description?: string
    created_at: ISODateString
    updated_at: ISODateString
}

export interface ClinicConfigSettings {
    clinic_id: string
    location?: string
    ltSiteId?: string
    customerId?: string
    hospitalOrClinic?: 'HOSPITAL' | 'CLINIC' | string
    updated_at: ISODateString
}

export interface IdJsonConfigRow {
    id: string
    name?: string
    /** free-form JSON string for now to keep schema flexible */
    config_json: string
    updated_at: ISODateString
}

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Key: clinic_id -> mappings[]
export const mappingsStore: Map<string, ValueMapping[]> = new Map()

// Key: clinic_id -> clinic settings
export const clinicSettingsStore: Map<string, ClinicConfigSettings> = new Map()

// Key: clinic_id -> (TPA_ID -> row)
export const tpaConfigStore: Map<string, Map<string, IdJsonConfigRow>> = new Map()

// Key: clinic_id -> (plan/network ID -> row)
export const plansConfigStore: Map<string, Map<string, IdJsonConfigRow>> = new Map()
export const networksConfigStore: Map<string, Map<string, IdJsonConfigRow>> = new Map()

// Key: clinic_id -> (doctor ID -> row)
export const doctorsConfigStore: Map<string, Map<string, IdJsonConfigRow>> = new Map()


