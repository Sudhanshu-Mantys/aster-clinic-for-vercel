/**
 * API endpoint to save/update patient insurance policy details to Aster
 * Calls the update endpoint: /claim/update/patient/insurace/details/replicate
 */
import { NextApiRequest, NextApiResponse } from 'next';

// Use tunnel by default (safer, works from any network)
// Set NEXT_USE_TUNNEL=false to bypass tunnel for direct access
const useTunnel = process.env.NEXT_USE_TUNNEL !== 'false';

const API_BASE_URL = useTunnel
  ? 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php'
  : 'https://prod.asterclinics.com/SCMS/web/app.php';

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
    console.log('Saving policy for patient:', patientId);

    // Remove fields that are not in the API specification
    const { planCode, planId, ...cleanPolicyData } = policyData;

    // Build the payload matching the API specification
    // The API expects: head { reqtime, srvseqno, reqtype } and body { ...policyData }
    const payload = {
      head: {
        reqtime: new Date().toDateString(),
        srvseqno: "",
        reqtype: "POST"
      },
      body: {
        // Use policyId from existing policy if available, otherwise 0 for new policy
        policyId: cleanPolicyData.policyId || 0,
        isActive: cleanPolicyData.isActive ?? 1,
        // Ensure payerId is a number or null
        payerId: cleanPolicyData.payerId
          ? (typeof cleanPolicyData.payerId === 'string' ? parseInt(cleanPolicyData.payerId, 10) : cleanPolicyData.payerId)
          : null,
        insuranceCompanyId: cleanPolicyData.insuranceCompanyId || null,
        // Ensure networkId is a number or null
        networkId: cleanPolicyData.networkId
          ? (typeof cleanPolicyData.networkId === 'string' ? parseInt(cleanPolicyData.networkId, 10) : cleanPolicyData.networkId)
          : null,
        siteId: cleanPolicyData.siteId || 31,
        policyNumber: cleanPolicyData.policyNumber || null,
        insuranceGroupPolicyId: cleanPolicyData.insuranceGroupPolicyId || null,
        encounterid: cleanPolicyData.encounterid ?? null, // Note: lowercase 'id' as per API, use null instead of 0
        parentInsPolicyId: cleanPolicyData.parentInsPolicyId || null,
        tpaCompanyId: cleanPolicyData.tpaCompanyId || null,
        planName: cleanPolicyData.planName || null,
        eligibilityReqId: cleanPolicyData.eligibilityReqId || null,
        tpaPolicyId: cleanPolicyData.tpaPolicyId || null,
        // insRules should be an array or null - if null, use empty array or keep as provided
        insRules: cleanPolicyData.insRules || null,
        orgId: cleanPolicyData.orgId || null,
        insuranceMappingId: cleanPolicyData.insuranceMappingId || null,
        tpaGroupPolicyId: cleanPolicyData.tpaGroupPolicyId || null,
        apntId: cleanPolicyData.apntId || null,
        insuranceValidTill: cleanPolicyData.insuranceValidTill || null,
        orgName: cleanPolicyData.orgName || null,
        tpaValidTill: cleanPolicyData.tpaValidTill || null,
        patientId: patientId,
        insuranceRenewal: cleanPolicyData.insuranceRenewal || null,
        payerType: cleanPolicyData.payerType || 1,
        insuranceStartDate: cleanPolicyData.insuranceStartDate || null,
        insurancePolicyId: cleanPolicyData.insurancePolicyId || null,
        hasTopUpCard: cleanPolicyData.hasTopUpCard ?? 0,
        proposerRelation: cleanPolicyData.proposerRelation || "Self",
        createdBy: cleanPolicyData.createdBy || null,
        empId: cleanPolicyData.empId || null,
        requestLetter: cleanPolicyData.requestLetter || null,
        insertType: cleanPolicyData.insertType || 2,
        customerId: cleanPolicyData.customerId || 1,
        type: cleanPolicyData.type || 1,
        relationshipId: cleanPolicyData.relationshipId || 26,
        priorityPatientApplicable: cleanPolicyData.priorityPatientApplicable ?? 0,
        typeId: cleanPolicyData.typeId || 1,
        DepData: cleanPolicyData.DepData || null,
      }
    };

    console.log('Sending payload to update endpoint:', JSON.stringify(payload, null, 2));

    // Call the update endpoint
    const updateResponse = await fetch(
      `${API_BASE_URL}/claim/update/patient/insurace/details/replicate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'app:/TrendEHR.swf',
          'x-flash-version': '32,0,0,182',
          'Accept-Encoding': 'gzip,deflate',
          'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
        },
        body: JSON.stringify(payload),
      }
    );

    const updateResult = await updateResponse.json();
    console.log('Update response:', JSON.stringify(updateResult, null, 2));

    if (!updateResponse.ok || updateResult.head?.StatusValue !== 'Success') {
      console.error('Failed to save policy:', updateResult);
      return res.status(updateResponse.status || 500).json({
        error: updateResult.head?.StatusText || 'Failed to save policy details',
        details: updateResult,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Policy details saved successfully',
      data: updateResult,
    });
  } catch (error) {
    console.error('Error saving policy details:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
