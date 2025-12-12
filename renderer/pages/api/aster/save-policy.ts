/**
 * API endpoint to fetch existing patient insurance policy details from Aster
 * Returns the current policy without making any updates
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

    console.log('Incoming policyData:', JSON.stringify(policyData, null, 2));
    console.log('Step 1: Fetching existing insurance details for patient:', patientId);

    // Step 1: Fetch existing insurance details to get the policy ID
    // Note: encounterId can be null for manual searches or policy updates without encounter context
    let insuranceData = null;
    let insuranceResponse = null;

    // First attempt: with appointment ID if available (encounterId can be null)
    if (appointmentId) {
      console.log('  Trying with appointment ID (encounterId:', encounterId ?? 'null', ')...');
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
            encounterId: encounterId ?? null, // Can be null for policy details
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
            encounterId: null, // Can be null for policy details
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

    // Step 3: Return the existing policy without making any updates
    console.log('Returning existing policy without updates');

    return res.status(200).json({
      success: true,
      data: existingPolicy,
    });
  } catch (error) {
    console.error('Error fetching policy details:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
