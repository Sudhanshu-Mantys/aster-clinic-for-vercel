import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Next.js API Route - Patient Details Proxy
 * This route acts as a proxy to avoid CORS issues when calling the Aster Clinics API
 */

const API_BASE_URL = 'https://stage.asterclinics.com/SCMS/web/app_sbox.php'

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

