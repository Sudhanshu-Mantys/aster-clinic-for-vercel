/**
 * API utilities for making requests to Aster Clinics backend
 * Uses Next.js API routes as a proxy to avoid CORS issues
 */

export interface PatientData {
    relationshipid: number
    relationshipname: string
    firstname: string
    middlename: string
    lastname: string
    address1: string
    address2: string
    city: string | null
    stateid: number | null
    statename: string | null
    zip: string | null
    phone: string | null
    callnotes: string | null
    email: string | null
    self: number
    home_phone: string | null
    phone_other: string | null
    patient_demog_id: number
    patient_id: number
    uid_value: string
    driver_lic: string
    dob: string
    marital_status_id: number | null
    sex_id: number
    blood_type_id: number | null
    calculated_age: string
    is_estimated: string
    age: string
    pan_no: string
    passport_no: string
    education_level: string | null
    mother_tongue: string | null
    identification_mark: string
    smoking_status_id: number | null
    alcohol_status_id: number | null
    dom: string
    other_mother_tongue: string
    other_education: string
    country_id: number
    is_vip: number | null
    comments: string | null
    is_deceased: number
    has_id: number
    reason: string | null
    visa: string | null
    issue_date: string | null
    expiry_date: string | null
    pat_nationality: number
    po_box_num: string
    gender: string
    mpi: string
    nationality: string
    mar_status: string | null
    area: string | null
    is_phone_overrided: number
    is_alternate_phoneno_overrided: number
    printed_on: string
    iso_code: string
    sponser_org_name: string | null
    pat_arabic_name: string | null
    has_image: string
    occupation_id: number
    is_nabidh_private: number | null
    nabidh_consent: number | null
    visa_type: string | null
    gcc_id: string | null
    relationship_type: string | null
    associated_nationality_id: number | null
}

interface PatientDetailsResponse {
    head: {
        StatusValue: number
        StatusText: string
    }
    body: {
        Data: PatientData[]
        RecordCount: number
        TotalRecords: number | null
    }
}

/**
 * Fetch patient details by patient ID
 * @param patientId - The patient ID to search for
 * @param customerId - Customer ID (default: 1)
 * @param siteId - Site ID (default: 1)
 * @param encounterId - Encounter ID (default: 0)
 * @param appointmentId - Appointment ID (optional)
 */
export async function getPatientDetails(
    patientId: number,
    customerId: number = 1,
    siteId: number = 1,
    encounterId: number = 0,
    appointmentId?: number
): Promise<PatientDetailsResponse> {
    try {
        // Call our Next.js API route (proxy) to avoid CORS issues
        const response = await fetch('/api/patient/details', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                patientId,
                customerId,
                siteId,
                encounterId,
                appointmentId: appointmentId || 0,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `API request failed with status ${response.status}`)
        }

        return data
    } catch (error) {
        console.error('Error fetching patient details:', error)
        throw error
    }
}

/**
 * Search for patient by MPI (Master Patient Index)
 * @param mpi - The MPI to search for
 * @param customerSiteId - Customer Site ID (default: 1)
 */
export async function searchPatientByMPI(
    mpi: string,
    customerSiteId: number = 1
): Promise<PatientDetailsResponse> {
    try {
        // Call our Next.js API route (proxy) to avoid CORS issues
        const response = await fetch('/api/patient/search-mpi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mpi,
                customerSiteId,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `API request failed with status ${response.status}`)
        }

        return data
    } catch (error) {
        console.error('Error searching patient by MPI:', error)
        throw error
    }
}

/**
 * Search for patient by phone number
 * @param phoneNumber - The phone number to search for
 * @param customerSiteId - Customer Site ID (default: 1)
 */
export async function searchPatientByPhone(
    phoneNumber: string,
    customerSiteId: number = 1
): Promise<PatientDetailsResponse> {
    try {
        // Call our Next.js API route (proxy) to avoid CORS issues
        const response = await fetch('/api/patient/search-phone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phoneNumber,
                customerSiteId,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || `API request failed with status ${response.status}`)
        }

        return data
    } catch (error) {
        console.error('Error searching patient by phone number:', error)
        throw error
    }
}

