import type { NextApiRequest, NextApiResponse } from 'next'
import { patientContextRedisService } from '../../../lib/redis-patient-context'

/**
 * Next.js API Route - Patient Insurance Details Proxy
 * This route acts as a proxy to avoid CORS issues when calling the Aster Clinics API
 * Automatically stores insurance details in Redis after successful fetch
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

interface InsuranceDetailsRequestBody {
    apntId: number | null
    patientId: number
    encounterId: number
    customerId: number
    primaryInsPolicyId: number | null
    siteId: number
    isDiscard: number
    hasTopUpCard: number
}

interface InsuranceDetailsRequest {
    head: RequestHead
    body: InsuranceDetailsRequestBody
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
        apntId = null,
        encounterId = 0,
        customerId = 1,
        primaryInsPolicyId = null,
        siteId = 1,
        isDiscard = 0,
        hasTopUpCard = 0,
    } = req.body

    // Validate required parameters
    if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' })
    }

    // Build the request body for the Aster Clinics API
    const requestBody: InsuranceDetailsRequest = {
        head: {
            reqtime: getRequestTime(),
            srvseqno: '',
            reqtype: 'POST',
        },
        body: {
            apntId: apntId ? parseInt(apntId, 10) : null,
            patientId: parseInt(patientId, 10),
            encounterId: parseInt(encounterId, 10),
            customerId,
            primaryInsPolicyId: primaryInsPolicyId ? parseInt(primaryInsPolicyId, 10) : null,
            siteId,
            isDiscard,
            hasTopUpCard,
        },
    }

    console.log('Fetching insurance details for patient:', patientId)
    console.log('Request body:', JSON.stringify(requestBody, null, 2))

    try {
        // Make the request to the Aster Clinics API
        const response = await fetch(`${API_BASE_URL}/claim/insurance/details/replicate/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'app:/TrendEHR.swf',
                'Accept': 'text/xml, application/xml, application/xhtml+xml, text/html;q=0.9, text/plain;q=0.8, text/css, image/png, image/jpeg, image/gif;q=0.8, application/x-shockwave-flash, video/mp4;q=0.9, flv-application/octet-stream;q=0.8, video/x-flv;q=0.7, audio/mp4, application/futuresplash, */*;q=0.5, application/x-mpegURL',
                'x-flash-version': '32,0,0,182',
                'Accept-Encoding': 'gzip,deflate',
                'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
            },
            body: JSON.stringify(requestBody),
        })

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text()
            console.error('Non-JSON response received:', textResponse.substring(0, 500))
            return res.status(500).json({
                error: 'Couldn\'t fetch insurance details',
            })
        }

        // Get the response data
        const data = await response.json()

        console.log('Insurance details response:', JSON.stringify(data, null, 2))

        // Check if the response is ok
        if (!response.ok) {
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                data,
            })
            return res.status(response.status).json({
                error: data.head?.StatusText || 'Failed to fetch insurance details',
                details: data,
            })
        }

        // Check if the API returned an error
        if (data.head && data.head.StatusValue !== 200) {
            return res.status(400).json({
                error: data.head.StatusText || 'Failed to fetch insurance details',
                details: data,
            })
        }

        // Automatically store insurance details in Redis after successful fetch
        try {
            const parsedPatientId = parseInt(patientId, 10);
            if (parsedPatientId && !isNaN(parsedPatientId)) {
                await patientContextRedisService.storeInsuranceDetails(
                    parsedPatientId,
                    data
                );
                console.log(`✅ Auto-stored insurance details for patient:${parsedPatientId}`);
            } else {
                console.warn(`⚠️ Could not store insurance details: invalid patientId ${patientId}`);
            }
        } catch (storageError) {
            // Log error but don't fail the request - insurance details were fetched successfully
            console.error('Failed to store insurance details in Redis:', storageError);
        }

        // Return the successful response (even if no insurance records found)
        return res.status(200).json(data)
    } catch (error) {
        console.error('Proxy error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        })
    }
}

