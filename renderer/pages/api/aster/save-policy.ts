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
    const insuranceResponse = await fetch(`${API_BASE_URL}/claim/patient/insurance/details/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        head: {
          reqtime: new Date().toDateString(),
          srvseqno: "",
          reqtype: "POST"
        },
        body: {
          apntId: appointmentId || null,
          patientId: patientId,
          encounterId: encounterId || 0,
          customerId: 1,
          primaryInsPolicyId: null,
          siteId: 31,
          isDiscard: 0,
          hasTopUpCard: 0,
        }
      })
    });

    const insuranceData = await insuranceResponse.json();
    console.log('Insurance data fetched:', JSON.stringify(insuranceData, null, 2));

    if (!insuranceResponse.ok || !insuranceData.body?.Data) {
      console.error('Failed to fetch insurance details');
      return res.status(400).json({
        error: 'Could not fetch existing insurance details',
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

    // Step 3: Update the policy data with the existing policy ID
    const updatedPolicyData = {
      ...policyData,
      policyId: existingPolicy.patient_insurance_tpa_policy_id,
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
