import type { NextApiRequest, NextApiResponse } from 'next'
import { patientContextRedisService } from '../../../lib/redis-patient-context'

/**
 * Next.js API Route - Flexible Appointment Search Proxy
 * This route acts as a proxy to avoid CORS issues when calling the Aster Clinics API
 * Supports all search parameters including custom date ranges
 */

// Use tunnel by default (safer, works from any network)
// Set NEXT_USE_TUNNEL=false to bypass tunnel for direct access
const useTunnel = process.env.NEXT_USE_TUNNEL !== 'false'

const API_BASE_URL = useTunnel
    ? 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php'
    : 'https://prod.asterclinics.com/SCMS/web/app.php'


interface RequestHead {
    reqtime: string
    srvseqno: string
    reqtype: string
}

interface AppointmentSearchRequestBody {
    payerId: null | number
    visitTypeId: null | number
    recPerPage: number
    mpii1: null | string
    patientName: null | string
    mobPhn: null | string | number
    groupByApntStatus: number
    appStatusId: string
    referralUploadFilter: number
    orderType: null | string
    timeOrderBy: number
    filterByReferral: number
    mcnNo: null | string
    visitPurposeId: null | number
    mpii2: null | string
    isFilterDate: number
    displayEncounterNumber: null | string
    physicianId: null | number
    payerTypeId: null | number
    specialisationId: null | number
    insuranceType: null | string
    customerSiteId: number
    roomId: null | number
    isEmergencyAppointment: null | number
    fromDate: string
    type: null | string
    toDate: string
    pageNo: number
    encounterType: number
}

interface AppointmentSearchRequest {
    head: RequestHead
    body: AppointmentSearchRequestBody
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

/**
 * Parse date string in MM/DD/YYYY format to Date object
 */
function parseDate(dateStr: string): Date {
    const parts = dateStr.split('/')
    if (parts.length !== 3) {
        throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY`)
    }
    const month = parseInt(parts[0]) - 1 // JS months are 0-indexed
    const day = parseInt(parts[1])
    const year = parseInt(parts[2])
    return new Date(year, month, day)
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    console.log('=== Appointment Search API Called ===')
    console.log('Method:', req.method)
    console.log('Request body:', JSON.stringify(req.body, null, 2))

    // Only allow POST requests
    if (req.method !== 'POST') {
        console.error('❌ Invalid method:', req.method)
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const {
        // Search filters
        mpi,
        phoneNumber,
        patientName,
        mcnNo,
        displayEncounterNumber,

        // Date filters
        fromDate,
        toDate,
        isFilterDate = 1,

        // Pagination
        pageNo = 0,
        recPerPage = 20,

        // IDs and filters
        customerSiteId = 1,
        payerId = null,
        visitTypeId = null,
        physicianId = null,
        specialisationId = null,
        roomId = null,
        visitPurposeId = null,
        payerTypeId = null,

        // Status and type filters
        appStatusId = '16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27',
        encounterType = 1,
        isEmergencyAppointment = null,
        insuranceType = null,

        // Other filters
        groupByApntStatus = 0,
        referralUploadFilter = 0,
        filterByReferral = 0,
        timeOrderBy = 2,
        orderType = null,
        type = null,
    } = req.body

    console.log('Extracted search params:', {
        mpi,
        phoneNumber,
        patientName,
        fromDate,
        toDate,
        customerSiteId,
        pageNo,
    })

    // Validate that at least one search parameter is provided or date range is set
    if (!mpi && !phoneNumber && !patientName && !mcnNo && !displayEncounterNumber && !fromDate) {
        console.error('❌ No search parameters provided')
        return res.status(400).json({
            error: 'At least one search parameter is required (mpi, phoneNumber, patientName, mcnNo, displayEncounterNumber, or date range)'
        })
    }

    // Handle date range
    let formattedFromDate: string
    let formattedToDate: string

    if (fromDate && toDate) {
        // Use provided date range
        try {
            formattedFromDate = fromDate
            formattedToDate = toDate
            console.log('Using provided date range:', { fromDate: formattedFromDate, toDate: formattedToDate })
        } catch (error) {
            console.error('❌ Invalid date format:', error)
            return res.status(400).json({
                error: 'Invalid date format. Expected MM/DD/YYYY'
            })
        }
    } else if (fromDate) {
        // Only from date provided, use it as both from and to
        formattedFromDate = fromDate
        formattedToDate = fromDate
        console.log('Using single date:', formattedFromDate)
    } else {
        // Default to today's date
        const today = new Date()
        formattedFromDate = formatDate(today)
        formattedToDate = formatDate(today)
        console.log('Using default date (today):', formattedFromDate)
    }

    // Build the request body for the Aster Clinics API
    const requestBody: AppointmentSearchRequest = {
        head: {
            reqtime: getRequestTime(),
            srvseqno: '',
            reqtype: 'POST',
        },
        body: {
            payerId,
            visitTypeId,
            recPerPage,
            mpii1: mpi || null,
            patientName: patientName || null,
            mobPhn: phoneNumber || null,
            groupByApntStatus,
            appStatusId,
            referralUploadFilter,
            orderType,
            timeOrderBy,
            filterByReferral,
            mcnNo: mcnNo || null,
            visitPurposeId,
            mpii2: null,
            isFilterDate,
            displayEncounterNumber: displayEncounterNumber || null,
            physicianId,
            payerTypeId,
            specialisationId,
            insuranceType,
            customerSiteId,
            roomId,
            isEmergencyAppointment,
            fromDate: formattedFromDate,
            type,
            toDate: formattedToDate,
            pageNo,
            encounterType,
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
                error: 'Couldn\'t fetch appointments',
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
                error: data.head?.StatusText || 'Failed to search appointments',
                details: data,
            })
        }

        // Check if the API returned an error
        if (data.head && data.head.StatusValue !== 200) {
            console.error('❌ API returned error status:', data.head)
            return res.status(400).json({
                error: data.head.StatusText || 'Failed to search appointments',
                details: data,
            })
        }

        console.log('✅ API response OK, RecordCount:', data.body?.RecordCount)

        // Check if no data was found
        if (data.body.RecordCount === 0 || !data.body.Data || data.body.Data.length === 0) {
            console.log('⚠️ No appointments found')
            return res.status(404).json({
                error: 'No appointments found matching the search criteria',
                details: data,
            })
        }

        console.log('✅ Found', data.body.Data.length, 'appointments')

        // Store patient context in Redis in bulk (background task - fire and forget)
        if (data.body?.Data && Array.isArray(data.body.Data)) {
            console.log(`📝 Preparing to store ${data.body.Data.length} appointments in Redis`);

            const contexts = data.body.Data
                .filter((appointmentData) => {
                    const hasRequired = appointmentData.mpi && appointmentData.patient_id;
                    if (!hasRequired) {
                        console.warn(`⚠️ Skipping appointment ${appointmentData.appointment_id} - missing mpi or patient_id`);
                    }
                    return hasRequired;
                })
                .map((appointmentData) => {
                    // Store all appointment data fields, ensuring required fields are present
                    const context: any = {
                        // Include all appointment data fields first
                        ...appointmentData,

                        // Required fields (override to ensure they're present and correctly named)
                        mpi: appointmentData.mpi,
                        patientId: appointmentData.patient_id,
                        patientName: appointmentData.full_name || "",
                        lastUpdated: new Date().toISOString(),

                        // Map field names to match our interface (override original field names)
                        appointmentId: appointmentData.appointment_id,
                        encounterId: appointmentData.encounter_id,
                        phone: appointmentData.mobile_phone,
                        email: appointmentData.email,
                        // Explicitly ensure physician_id is included (from appointmentData or as physicianId)
                        physician_id: appointmentData.physician_id || appointmentData.physicianId || undefined,
                    };

                    return context;
                });

            console.log(`📝 Filtered to ${contexts.length} valid contexts to store`);

            if (contexts.length > 0) {
                // Run as background task - don't await
                patientContextRedisService
                    .storeBulkPatientContexts(contexts)
                    .then(() => {
                        console.log(
                            `✅ Successfully bulk stored ${contexts.length} patient contexts in Redis`,
                        );
                        // Log a sample of what was stored
                        if (contexts.length > 0) {
                            const sample = contexts[0];
                            console.log(`📋 Sample stored context - MPI: ${sample.mpi}, PatientId: ${sample.patientId}, AppointmentId: ${sample.appointmentId}`);
                        }
                    })
                    .catch((redisError) => {
                        console.error(
                            "❌ Failed to bulk store appointment contexts in Redis (non-fatal):",
                            redisError,
                        );
                        console.error("Error details:", redisError instanceof Error ? redisError.message : String(redisError));
                        console.error("Error stack:", redisError instanceof Error ? redisError.stack : "No stack trace");
                    });
            } else {
                console.warn("⚠️ No valid contexts to store in Redis");
            }
        } else {
            console.warn("⚠️ No appointment data found in response to store in Redis");
        }

        // Return the raw appointment data (no transformation needed for appointments)
        return res.status(200).json(data)
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

