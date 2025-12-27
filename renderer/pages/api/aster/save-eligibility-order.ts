/**
 * API endpoint to save eligibility authorization order details to Aster
 * This should be called after uploading eligibility documents
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { patientContextRedisService } from '../../../lib/redis-patient-context';

const API_BASE_URL = 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php';

interface SaveEligibilityOrderRequest {
    patientId: number;
    appointmentId: number;
    encounterId?: number;
    insuranceMappingId: number; // hospital_insurance_mapping_id for main body
    insTpaPatId?: number; // insTpaPatId for ordObj.insuranceMappingId
    physicianId?: number;
    authorizationNumber?: string;
    authorizationName?: string;
    authDate?: string; // Format: YYYY/MM/DD
    authExpDate?: string; // Format: YYYY/MM/DD
    createdBy?: number;
    vendorId?: number;
    siteId?: number;
}

/**
 * Format date to YYYY/MM/DD format for Aster API
 */
function formatDateForAster(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const requestData: SaveEligibilityOrderRequest = req.body;

        // Validate required fields
        if (!requestData.patientId) {
            return res.status(400).json({ error: 'patientId is required' });
        }
        if (!requestData.appointmentId) {
            return res.status(400).json({ error: 'appointmentId is required' });
        }
        if (!requestData.insuranceMappingId) {
            return res.status(400).json({ error: 'insuranceMappingId is required' });
        }

        console.log('📋 Saving eligibility order:', {
            patientId: requestData.patientId,
            appointmentId: requestData.appointmentId,
            insuranceMappingId: requestData.insuranceMappingId,
        });

        // Fetch physician ID from Redis appointment store if not provided
        let physicianId = requestData.physicianId;
        if (!physicianId && requestData.appointmentId) {
            try {
                const appointmentContext = await patientContextRedisService.getPatientContextByAppointmentId(
                    requestData.appointmentId
                );
                if (appointmentContext?.physician_id) {
                    physicianId = appointmentContext.physician_id;
                    console.log(`✅ Fetched physician_id ${physicianId} from Redis for appointment ${requestData.appointmentId}`);
                } else {
                    console.warn(`⚠️ No physician_id found in Redis for appointment ${requestData.appointmentId}`);
                }
            } catch (error) {
                console.error('❌ Error fetching physician ID from Redis:', error);
                // Continue with null if Redis fetch fails
            }
        }

        // Prepare dates
        const today = new Date();
        const authDate = requestData.authDate || formatDateForAster(today);
        const authExpDate = requestData.authExpDate || formatDateForAster(today);

        // Build the request payload matching the working format
        // Use insTpaPatId for ordObj.insuranceMappingId (not hospital_insurance_mapping_id)
        const ordObjInsuranceMappingId = requestData.insTpaPatId ?? null;

        const payload = {
            head: {
                reqtime: today.toDateString(), // e.g., "Fri Dec 12 2025"
                srvseqno: "",
                reqtype: "POST"
            },
            body: {
                reqId: 0,
                authExpDate: authExpDate,
                siteId: requestData.siteId || 31,
                result: 1,
                isInterSite: 0,
                mcnNumber: null,
                reqCreatedBy: requestData.createdBy || 13295,
                reqType: 2,
                denialCodeId: null,
                apntId: requestData.appointmentId,
                eligibilityCheckRefId: null,
                reqStatus: 5,
                reqContent: null,
                eligibilityCheckResponse: null,
                reqResponse: null,
                limit: null,
                comment: "Uploaded Files From Mantys.",
                authorizationNumber: requestData.authorizationNumber || "",
                ordObj: [
                    {
                        reqPatientId: requestData.patientId,
                        authNumber: requestData.authorizationNumber || null, // Match authorizationNumber
                        encId: requestData.encounterId || null, // Use encounterId
                        eprescId: null,
                        authNetPayable: null,
                        authPatPayable: null,
                        insuranceMappingId: ordObjInsuranceMappingId, // Use insTpaPatId, not hospital_insurance_mapping_id
                        orderId: null,
                        authPayerPayable: null,
                        reqPhyId: physicianId ?? null,
                        authQty: null
                    }
                ],
                reqIsactive: 1,
                denCode: null,
                vendorId: requestData.vendorId || 24,
                idPayer: null,
                authDate: authDate,
                authName: requestData.authorizationName || "",
                customerId: 1
            }
        };

        console.log('📤 Sending payload to Aster:', JSON.stringify(payload, null, 2));

        // Make the API call
        const response = await fetch(
            `${API_BASE_URL}/claim/request/elibility/order/add`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'app:/TrendEHR.swf',
                    'Accept': 'text/xml, application/xml, application/xhtml+xml, text/html;q=0.9, text/plain;q=0.8, text/css, image/png, image/jpeg, image/gif;q=0.8, application/x-shockwave-flash, video/mp4;q=0.9, flv-application/octet-stream;q=0.8, video/x-flv;q=0.7, audio/mp4, application/futuresplash, */*;q=0.5, application/x-mpegURL',
                    'x-flash-version': '32,0,0,182',
                    'srvseqno': '""',
                    'api-key': '""',
                    'Accept-Encoding': 'gzip,deflate',
                    'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
                    'Connection': 'Keep-Alive',
                },
                body: JSON.stringify(payload),
            }
        );

        const responseText = await response.text();
        console.log('📥 Aster response status:', response.status);
        console.log('📥 Aster response body:', responseText);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.warn('Response is not JSON:', responseText);
            responseData = { rawResponse: responseText };
        }

        if (!response.ok) {
            console.error('❌ Failed to save eligibility order:', responseData);
            return res.status(response.status).json({
                error: 'Failed to save eligibility order',
                details: responseData,
            });
        }

        console.log('✅ Eligibility order saved successfully');

        return res.status(200).json({
            success: true,
            message: 'Eligibility order saved successfully',
            data: responseData,
        });
    } catch (error) {
        console.error('❌ Error saving eligibility order:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

