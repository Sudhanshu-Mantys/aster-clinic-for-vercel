/**
 * API endpoint to save/replicate patient insurance policy details to Aster
 */
import { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { policyData, patientId, appointmentId, encounterId, payerId } = req.body;

    if (!policyData || !patientId) {
      return res.status(400).json({ error: 'Policy data and patient ID are required' });
    }

    console.log('Step 1: Fetching existing insurance details for patient:', patientId);

    // Step 1: Fetch existing insurance details to get the policy ID
    // Try with different parameter combinations since manual searches might not have appointment/encounter
    let insuranceData = null;
    let insuranceResponse = null;

    // First attempt: with all IDs if available
    if (appointmentId && encounterId) {
      console.log('  Trying with appointment and encounter IDs...');
      insuranceResponse = await fetch(`${API_BASE_URL}/claim/insurance/details/replicate/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'app:/TrendEHR.swf',
          'x-flash-version': '32,0,0,182',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
        },
        body: JSON.stringify({
          head: {
            reqtime: new Date().toDateString(),
            srvseqno: "",
            reqtype: "POST"
          },
          body: {
            apntId: appointmentId,
            patientId: patientId,
            encounterId: encounterId,
            customerId: 1,
            primaryInsPolicyId: null,
            siteId: 31,
            isDiscard: 0,
            hasTopUpCard: 0,
          }
        })
      });

      insuranceData = await insuranceResponse.json();
      console.log('  Response:', insuranceData.head?.StatusValue);
    }

    // Second attempt: without appointment/encounter IDs (for manual searches)
    if (!insuranceData?.body?.Data) {
      console.log('  Trying with patient ID only...');
      insuranceResponse = await fetch(`${API_BASE_URL}/claim/insurance/details/replicate/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'app:/TrendEHR.swf',
          'x-flash-version': '32,0,0,182',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
        },
        body: JSON.stringify({
          head: {
            reqtime: new Date().toDateString(),
            srvseqno: "",
            reqtype: "POST"
          },
          body: {
            apntId: null,
            patientId: patientId,
            encounterId: 0,
            customerId: 1,
            primaryInsPolicyId: null,
            siteId: 31,
            isDiscard: 0,
            hasTopUpCard: 0,
          }
        })
      });

      insuranceData = await insuranceResponse.json();
    }

    console.log('Insurance data fetched:', JSON.stringify(insuranceData, null, 2));

    if (!insuranceData?.body?.Data || insuranceData.body.Data.length === 0) {
      console.error('No insurance policies found for patient');
      return res.status(404).json({
        error: 'No insurance policies found for this patient. Please ensure the patient has active insurance in Aster.',
        details: insuranceData,
      });
    }

    // Step 2: Find the matching policy by payer ID
    let existingPolicy = null;
    if (payerId) {
      existingPolicy = insuranceData.body.Data.find(
        (policy: any) => policy.payer_id === payerId
      );
    }

    // If no match by payer, try to find any active policy
    if (!existingPolicy && insuranceData.body.Data.length > 0) {
      existingPolicy = insuranceData.body.Data.find(
        (policy: any) => policy.is_current === 1 || policy.insurance_status?.toLowerCase() === 'active'
      );
    }

    // If still no match, use the first one
    if (!existingPolicy && insuranceData.body.Data.length > 0) {
      existingPolicy = insuranceData.body.Data[0];
    }

    if (!existingPolicy) {
      return res.status(404).json({
        error: 'No existing insurance policy found for this patient',
      });
    }

    console.log('Step 2: Found existing policy:', {
      policyId: existingPolicy.patient_insurance_tpa_policy_id,
      payerId: existingPolicy.payer_id,
      tpaName: existingPolicy.tpa_name,
    });

    // Step 3: Update the policy data with the existing policy ID and payerId
    // Remove payerId from policyData to ensure we use the one from existing policy
    const { payerId: _, ...policyDataWithoutPayerId } = policyData;

    const updatedPolicyData = {
      ...policyDataWithoutPayerId,
      policyId: existingPolicy.patient_insurance_tpa_policy_id,
      payerId: existingPolicy.payer_id, // Use payerId from existing Aster policy
      // Add "-mantys" suffix to member ID for testing
      tpaPolicyId: policyDataWithoutPayerId.tpaPolicyId
        ? `${policyDataWithoutPayerId.tpaPolicyId}-mantys`
        : null,
    };

    // Step 4: Prepare the request for Aster API
    const requestBody = {
      head: {
        reqtime: new Date().toDateString(),
        srvseqno: "",
        reqtype: "POST"
      },
      body: updatedPolicyData
    };

    console.log('Step 3: Sending policy update to Aster:', JSON.stringify(requestBody, null, 2));

    // Make request to Aster API
    const response = await fetch(
      'https://aster-clinics-dev.mantys.org/SCMS/web/app.php/claim/update/patient/insurace/details/replicate',
      {
        method: 'POST',
        headers: {
          'Referer': 'app:/TrendEHR.swf',
          'Accept': 'text/xml, application/xml, application/xhtml+xml, text/html;q=0.9, text/plain;q=0.8, text/css, image/png, image/jpeg, image/gif;q=0.8, application/x-shockwave-flash, video/mp4;q=0.9, flv-application/octet-stream;q=0.8, video/x-flv;q=0.7, audio/mp4, application/futuresplash, */*;q=0.5, application/x-mpegURL',
          'x-flash-version': '32,0,0,182',
          'Content-type': 'application/json',
          'srvseqno': '""',
          'api-key': '""',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
          'Connection': 'Keep-Alive',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const responseText = await response.text();
    console.log('Aster API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('Aster API error:', response.status, responseData);
      return res.status(response.status).json({
        error: 'Failed to save policy details',
        details: responseData,
      });
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error saving policy details:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
