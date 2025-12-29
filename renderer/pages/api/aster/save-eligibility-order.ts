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
 * Get current date/time components in Asia/Dubai timezone
 */
function getDubaiDateTime(): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const dubaiTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(now);

    return {
        year: parseInt(dubaiTime.find(part => part.type === 'year')?.value || '0'),
        month: parseInt(dubaiTime.find(part => part.type === 'month')?.value || '0'),
        day: parseInt(dubaiTime.find(part => part.type === 'day')?.value || '0'),
        hours: parseInt(dubaiTime.find(part => part.type === 'hour')?.value || '0'),
        minutes: parseInt(dubaiTime.find(part => part.type === 'minute')?.value || '0'),
        seconds: parseInt(dubaiTime.find(part => part.type === 'second')?.value || '0'),
    };
}

/**
 * Format date to YYYY/MM/DD format for Aster API (using Asia/Dubai timezone)
 */
function formatDateForAster(date?: Date): string {
    const dubaiTime = getDubaiDateTime();
    const year = dubaiTime.year;
    const month = String(dubaiTime.month).padStart(2, '0');
    const day = String(dubaiTime.day).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Format date to dd/mm/yy hh:mm format (using Asia/Dubai timezone)
 */
function formatDateTimeShort(): string {
    const dubaiTime = getDubaiDateTime();
    const day = String(dubaiTime.day).padStart(2, '0');
    const month = String(dubaiTime.month).padStart(2, '0');
    const year = String(dubaiTime.year).slice(-2);
    const hours = String(dubaiTime.hours).padStart(2, '0');
    const minutes = String(dubaiTime.minutes).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Generate authorization ID in format: DHA-F-{facility_code}-100{patient_id}-{ddmm}{hhmmss}
 * Uses Asia/Dubai timezone
 */
function generateAuthId(
    patientId: number,
    facilityCode: string = "0000043",
    prefix: string = "DHA-F"
): string {
    // Get current time in Asia/Dubai timezone
    const now = new Date();
    const dubaiTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(now);

    // Extract date and time parts
    const day = dubaiTime.find(part => part.type === 'day')?.value || '';
    const month = dubaiTime.find(part => part.type === 'month')?.value || '';
    const hour = dubaiTime.find(part => part.type === 'hour')?.value || '';
    const minute = dubaiTime.find(part => part.type === 'minute')?.value || '';
    const second = dubaiTime.find(part => part.type === 'second')?.value || '';

    // Format: DDMM and HHMMSS
    const ddmm = `${day}${month}`;
    const hhmmss = `${hour}${minute}${second}`;

    // Patient part: 100{patient_id}
    const patientPart = `100${patientId}`;

    return `${prefix}-${facilityCode}-${patientPart}-${ddmm}${hhmmss}`;
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
            encounterId: requestData.encounterId,
            insuranceMappingId: requestData.insuranceMappingId,
        });

        // Fetch physician ID and encounter ID from Redis appointment store if not provided
        let physicianId = requestData.physicianId;
        let encounterId = requestData.encounterId;

        if (requestData.appointmentId) {
            try {
                const appointmentContext = await patientContextRedisService.getPatientContextByAppointmentId(
                    requestData.appointmentId
                );

                // Fetch physician_id if not provided (check both snake_case and camelCase)
                if (!physicianId) {
                    physicianId = appointmentContext?.physician_id || appointmentContext?.physicianId || undefined;
                    if (physicianId) {
                        // Ensure it's a number
                        physicianId = typeof physicianId === 'number' ? physicianId : parseInt(String(physicianId), 10);
                        if (isNaN(physicianId)) {
                            physicianId = undefined;
                        } else {
                            console.log(`✅ Fetched physician_id ${physicianId} from Redis for appointment ${requestData.appointmentId}`);
                        }
                    }
                }

                if (!physicianId) {
                    console.warn(`⚠️ No physician_id found in Redis for appointment ${requestData.appointmentId}`);
                }

                // Fetch encounter_id if not provided (check both snake_case and camelCase)
                if (true) {
                    encounterId = appointmentContext?.encounter_id || appointmentContext?.encounterId || undefined;
                    if (encounterId) {
                        console.log(`✅ Fetched encounter_id ${encounterId} from Redis appointment key for appointment ${requestData.appointmentId}`);
                    } else {
                        console.warn(`⚠️ No encounter_id found in Redis appointment key for appointment ${requestData.appointmentId}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching appointment context from Redis:', error);
                // Continue with existing values if Redis fetch fails
            }
        }

        // Validate that physicianId is present and is an integer
        if (!physicianId || !Number.isInteger(physicianId) || physicianId <= 0) {
            console.error('❌ Invalid or missing physicianId:', physicianId);
            return res.status(400).json({
                error: 'physicianId is required and must be a positive integer',
                details: {
                    provided: requestData.physicianId,
                    fetched: physicianId,
                    appointmentId: requestData.appointmentId
                }
            });
        }

        // Prepare dates (using Asia/Dubai timezone)
        const today = new Date(); // Used for reqtime only
        const authDate = requestData.authDate || formatDateForAster();
        const authExpDate = requestData.authExpDate || formatDateForAster();

        // Generate authorization ID if not provided
        const authId = requestData.authorizationNumber || generateAuthId(requestData.patientId);

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
                comment: `Uploaded Files From Mantys. @ ${formatDateTimeShort()}`,
                authorizationNumber: authId,
                ordObj: [
                    {
                        reqPatientId: requestData.patientId,
                        authNumber: authId,
                        encId: encounterId || null, // Use encounterId from request or Redis
                        eprescId: null,
                        authNetPayable: null,
                        authPatPayable: null,
                        insuranceMappingId: ordObjInsuranceMappingId, // Use insTpaPatId, not hospital_insurance_mapping_id
                        orderId: null,
                        authPayerPayable: null,
                        reqPhyId: physicianId, // Already validated above, guaranteed to be a positive integer
                        authQty: null
                    }
                ],
                reqIsactive: 1,
                denCode: null,
                vendorId: requestData.vendorId || 24,
                idPayer: null,
                authDate: authDate,
                authName: authId,
                customerId: 1
            }
        };

        console.log('📤 Sending payload to Aster:', JSON.stringify(payload, null, 2));

        // Create an AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 seconds timeout

        try {
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
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

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
        } catch (fetchError) {
            clearTimeout(timeoutId);

            // Handle timeout specifically
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error('❌ Request timeout: Aster API took too long to respond');
                return res.status(408).json({
                    error: 'Request timeout',
                    message: 'The eligibility order API took too long to respond. Please try again.',
                });
            }
            throw fetchError; // Re-throw to outer catch block
        }
    } catch (error) {
        console.error('❌ Error saving eligibility order:', error);

        // Handle timeout errors
        if (error instanceof Error && error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'The eligibility order API took too long to respond. Please try again.',
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

