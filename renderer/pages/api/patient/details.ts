import type { NextApiRequest, NextApiResponse } from 'next'
import { patientContextRedisService } from '../../../lib/redis-patient-context'

/**
 * Next.js API Route - Patient Details Proxy
 * This route acts as a proxy to avoid CORS issues when calling the Aster Clinics API
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

interface PatientDetailsRequestBody {
    customerId: number
    siteId: number
    patientId: number
    encounterId: number
    appointmentId: number
}

interface PatientDetailsRequest {
    head: RequestHead
    body: PatientDetailsRequestBody
}

/**
 * Get current date/time in the format expected by the API
 */
function getRequestTime(): string {
    return new Date().toDateString() // Format: "Thu Nov 27 2025"
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const {
        patientId,
        customerId = 1,
        siteId = 1,
        encounterId = 0,
        appointmentId = 0,
    } = req.body

    // Validate required parameters
    if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' })
    }

    // Build the request body for the Aster Clinics API
    const requestBody: PatientDetailsRequest = {
        head: {
            reqtime: getRequestTime(),
            srvseqno: '',
            reqtype: 'POST',
        },
        body: {
            customerId,
            siteId,
            patientId: parseInt(patientId, 10),
            encounterId,
            appointmentId,
        },
    }

    try {
        // Make the request to the Aster Clinics API
        const response = await fetch(`${API_BASE_URL}/claim/get/patient/details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })

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

        // Check if the response is ok
        if (!response.ok) {
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                data,
            })
            return res.status(response.status).json({
                error: data.head?.StatusText || 'Failed to fetch patient details',
                details: data,
            })
        }

        // Check if the API returned an error
        if (data.head && data.head.StatusValue !== 200) {
            return res.status(400).json({
                error: data.head.StatusText || 'Failed to fetch patient details',
                details: data,
            })
        }

        // Check if no data was found
        if (data.body.RecordCount === 0 || data.body.Data.length === 0) {
            return res.status(404).json({
                error: 'No patient found with this ID',
                details: data,
            })
        }

        // Store patient context in Redis if we have the data
        try {
            const patientData = data.body.Data[0];
            if (patientData && patientData.mpi && patientData.patient_id) {
                const patientName = `${patientData.firstname || ''} ${patientData.lastname || ''}`.trim();

                await patientContextRedisService.storePatientContext({
                    mpi: patientData.mpi,
                    patientId: patientData.patient_id,
                    patientName,
                    appointmentId: appointmentId || undefined,
                    encounterId: encounterId || undefined,
                    phone: patientData.phone,
                    email: patientData.email,
                    dob: patientData.dob,
                    gender: patientData.gender,
                    // Include physician_id if available in patientData
                    physician_id: patientData.physician_id || patientData.physicianId || undefined,
                    lastUpdated: new Date().toISOString(),
                });

                console.log(`✅ Stored patient context in Redis - Patient ID: ${patientData.patient_id}, MPI: ${patientData.mpi}`);
            }
        } catch (redisError) {
            console.error('⚠️ Failed to store patient context in Redis (non-fatal):', redisError);
            // Continue even if Redis fails
        }

        // Return the successful response
        return res.status(200).json(data)
    } catch (error) {
        console.error('Proxy error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        })
    }
}

