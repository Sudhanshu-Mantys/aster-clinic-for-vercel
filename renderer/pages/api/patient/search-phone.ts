import type { NextApiRequest, NextApiResponse } from 'next'
import { patientContextRedisService } from '../../../lib/redis-patient-context'

/**
 * Next.js API Route - Phone Number Search Proxy
 * This route acts as a proxy to avoid CORS issues when calling the Aster Clinics API
 */

// Use tunnel by default (safer, works from any network)
// Set NEXT_USE_TUNNEL=false to bypass tunnel for direct access
const useTunnel = process.env.NEXT_USE_TUNNEL !== 'false'

// const API_BASE_URL = useTunnel ? 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php' : 'https://prod.asterclinics.com/SCMS/web/app.php'

const API_BASE_URL = "https://stage.asterclinics.com/SCMS/web/app_sbox.php"


interface RequestHead {
    reqtime: string
    srvseqno: string
    reqtype: string
}

interface PhoneSearchRequestBody {
    payerId: null
    visitTypeId: null
    recPerPage: number
    mpii1: null
    patientName: null
    mobPhn: string
    groupByApntStatus: number
    appStatusId: string
    referralUploadFilter: number
    orderType: null
    timeOrderBy: number
    filterByReferral: number
    mcnNo: null
    visitPurposeId: null
    mpii2: null
    isFilterDate: number
    displayEncounterNumber: null
    physicianId: null
    payerTypeId: null
    specialisationId: null
    insuranceType: null
    customerSiteId: number
    roomId: null
    isEmergencyAppointment: null
    fromDate: string
    type: null
    toDate: string
    pageNo: number
    encounterType: number
}

interface PhoneSearchRequest {
    head: RequestHead
    body: PhoneSearchRequestBody
}

/**
 * Get current date/time in the format expected by the API
 */
function getRequestTime(): string {
    return new Date().toDateString() // Format: "Thu Nov 27 2025"
}

/**
 * Format date to MM/DD/YYYY format
 */
function formatDate(date: Date): string {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    console.log('=== Phone Search API Called ===')
    console.log('Method:', req.method)
    console.log('Request body:', JSON.stringify(req.body, null, 2))

    // Only allow POST requests
    if (req.method !== 'POST') {
        console.error('❌ Invalid method:', req.method)
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const {
        phoneNumber,
        customerSiteId = 1,
    } = req.body

    console.log('Extracted params:', { phoneNumber, customerSiteId })

    // Validate required parameters
    if (!phoneNumber) {
        console.error('❌ Phone number is missing')
        return res.status(400).json({ error: 'Phone number is required' })
    }

    // Use today's date for search
    const today = new Date()
    console.log('Search date:', formatDate(today))

    // Build the request body for the Aster Clinics API
    const requestBody: PhoneSearchRequest = {
        head: {
            reqtime: getRequestTime(),
            srvseqno: '',
            reqtype: 'POST',
        },
        body: {
            payerId: null,
            visitTypeId: null,
            recPerPage: 20,
            mpii1: null,
            patientName: null,
            mobPhn: phoneNumber,
            groupByApntStatus: 0,
            appStatusId: '16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27',
            referralUploadFilter: 0,
            orderType: null,
            timeOrderBy: 2,
            filterByReferral: 0,
            mcnNo: null,
            visitPurposeId: null,
            mpii2: null,
            isFilterDate: 1,
            displayEncounterNumber: null,
            physicianId: null,
            payerTypeId: null,
            specialisationId: null,
            insuranceType: null,
            customerSiteId,
            roomId: null,
            isEmergencyAppointment: null,
            fromDate: formatDate(today),
            type: null,
            toDate: formatDate(today),
            pageNo: 0,
            encounterType: 1,
        },
    }

    console.log('Request body to send:', JSON.stringify(requestBody, null, 2))

    try {
        console.log('🚀 Making API request to:', `${API_BASE_URL}/apmgnt/patient/all/appointment/search/get`)

        // Make the request to the Aster Clinics API
        const response = await fetch(`${API_BASE_URL}/apmgnt/patient/all/appointment/search/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })

        console.log('📥 Response status:', response.status, response.statusText)

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text()
            console.error('Non-JSON response received:', textResponse.substring(0, 500))
            return res.status(500).json({
                error: 'Couldn\'t fetch patient details',
            })
        }

        // Get the response data
        const data = await response.json()
        console.log('📦 Response data:', JSON.stringify(data, null, 2))

        // Check if the response is ok
        if (!response.ok) {
            console.error('❌ API Response NOT OK:', {
                status: response.status,
                statusText: response.statusText,
                data,
            })
            return res.status(response.status).json({
                error: data.head?.StatusText || 'Failed to search patient by phone number',
                details: data,
            })
        }

        // Check if the API returned an error
        if (data.head && data.head.StatusValue !== 200) {
            console.error('❌ API returned error status:', data.head)
            return res.status(400).json({
                error: data.head.StatusText || 'Failed to search patient by phone number',
                details: data,
            })
        }

        console.log('✅ API response OK, RecordCount:', data.body?.RecordCount)

        // Check if no data was found
        if (data.body.RecordCount === 0 || !data.body.Data || data.body.Data.length === 0) {
            console.log('⚠️ No patients found')
            return res.status(404).json({
                error: 'No patient found with this phone number',
                details: data,
            })
        }

        console.log('🔄 Starting data transformation for', data.body.Data.length, 'patients')

        // Transform ALL appointment data to patient data format
        const transformedPatients = data.body.Data.map((appointmentData: any, index: number) => {
            console.log(`  Transforming patient ${index + 1}:`, {
                full_name: appointmentData.full_name,
                patient_id: appointmentData.patient_id,
                mpi: appointmentData.mpi,
            })

            // Parse full name into first, middle, last
            const nameParts = appointmentData.full_name?.trim().split(/\s+/) || []
            const firstname = nameParts[0] || ''
            const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
            const middlename = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''

            console.log(`    Name parts:`, { firstname, middlename, lastname })

            return {
                relationshipid: 0,
                relationshipname: '',
                firstname,
                middlename,
                lastname,
                address1: '',
                address2: '',
                city: null,
                stateid: null,
                statename: null,
                zip: null,
                phone: appointmentData.mobile_phone || null,
                callnotes: null,
                email: appointmentData.email || null,
                self: 1,
                home_phone: null,
                phone_other: null,
                patient_demog_id: 0,
                patient_id: appointmentData.patient_id,
                uid_value: appointmentData.nationality_id || '',
                driver_lic: '',
                dob: appointmentData.dob || '',
                marital_status_id: null,
                sex_id: appointmentData.gender_id || 0,
                blood_type_id: null,
                calculated_age: appointmentData.age || '',
                is_estimated: appointmentData.is_estimated || '0',
                age: appointmentData.age || '',
                pan_no: '',
                passport_no: '',
                education_level: null,
                mother_tongue: null,
                identification_mark: '',
                smoking_status_id: null,
                alcohol_status_id: null,
                dom: '',
                other_mother_tongue: '',
                other_education: '',
                country_id: 0,
                is_vip: null,
                comments: null,
                is_deceased: 0,
                has_id: 0,
                reason: null,
                visa: null,
                issue_date: null,
                expiry_date: null,
                pat_nationality: 0,
                po_box_num: '',
                gender: appointmentData.gender?.trim() || '',
                mpi: appointmentData.mpi || '',
                nationality: '',
                mar_status: null,
                area: null,
                is_phone_overrided: 0,
                is_alternate_phoneno_overrided: 0,
                printed_on: '',
                iso_code: '',
                sponser_org_name: null,
                pat_arabic_name: null,
                has_image: '0',
                occupation_id: 0,
                is_nabidh_private: null,
                nabidh_consent: null,
                visa_type: null,
                gcc_id: null,
                relationship_type: null,
                associated_nationality_id: null,
                // CRITICAL: Include appointment_id and encounter_id from the original response
                appointment_id: appointmentData.appointment_id,
                encounter_id: appointmentData.encounter_id,
            }
        })

        // Create transformed response with all patients
        const transformedData = {
            head: data.head,
            body: {
                Data: transformedPatients,
                RecordCount: transformedPatients.length,
                TotalRecords: transformedPatients.length,
            },
        }

        console.log('✅ Transformation complete, returning', transformedPatients.length, 'patients')
        console.log('Final response:', JSON.stringify(transformedData, null, 2))

        // Store patient context in Redis in bulk (background task - fire and forget)
        // Store complete appointment data instead of just limited fields
        if (data.body?.Data && Array.isArray(data.body.Data)) {
            const contexts = data.body.Data
                .filter((appointmentData) => appointmentData.mpi && appointmentData.patient_id)
                .map((appointmentData) => {
                    // Store all appointment data fields, ensuring required fields are present
                    const context: any = {
                        // Required fields
                        mpi: appointmentData.mpi,
                        patientId: appointmentData.patient_id,
                        patientName: appointmentData.full_name || '',
                        lastUpdated: new Date().toISOString(),

                        // Include all appointment data fields
                        ...appointmentData,

                        // Map field names to match our interface (if different)
                        appointmentId: appointmentData.appointment_id,
                        encounterId: appointmentData.encounter_id,
                        phone: appointmentData.mobile_phone,
                        email: appointmentData.email,
                        // Explicitly ensure physician_id is included (from appointmentData or as physicianId)
                        physician_id: appointmentData.physician_id || appointmentData.physicianId || undefined,
                    };

                    return context;
                });

            // Run as background task - don't await
            patientContextRedisService
                .storeBulkPatientContexts(contexts)
                .then(() => {
                    console.log(
                        `✅ Bulk stored ${contexts.length} patient contexts in Redis (Phone search)`,
                    );
                })
                .catch((redisError) => {
                    console.error(
                        '⚠️ Failed to bulk store phone search contexts in Redis (non-fatal):',
                        redisError,
                    );
                });
        }

        // Return the transformed response immediately without waiting for Redis
        return res.status(200).json(transformedData)
    } catch (error) {
        console.error('❌❌❌ PROXY ERROR ❌❌❌')
        console.error('Error type:', typeof error)
        console.error('Error instance:', error instanceof Error)
        console.error('Error object:', error)
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')

        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : String(error),
        })
    }
}

