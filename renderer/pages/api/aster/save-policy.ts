/**
 * API endpoint to save/update patient insurance policy details to Aster
 * Calls the update endpoint: /claim/update/patient/insurace/details/replicate
 */
import { NextApiRequest, NextApiResponse } from 'next';

// Use tunnel by default (safer, works from any network)
// Set NEXT_USE_TUNNEL=false to bypass tunnel for direct access
const useTunnel = process.env.NEXT_USE_TUNNEL !== 'false';

// const API_BASE_URL = useTunnel
//   ? 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php'
//   : 'https://prod.asterclinics.com/SCMS/web/app.php';

const API_BASE_URL = 'https://stage.asterclinics.com/SCMS/web/app_sbox.php'


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
        encounterid: cleanPolicyData.encounterid
          ? (typeof cleanPolicyData.encounterid === 'string' ? parseInt(cleanPolicyData.encounterid, 10) : cleanPolicyData.encounterid)
          : null,
        parentInsPolicyId: cleanPolicyData.parentInsPolicyId || null,
        tpaCompanyId: cleanPolicyData.tpaCompanyId || null,
        planName: cleanPolicyData.planName || null,
        eligibilityReqId: cleanPolicyData.eligibilityReqId || null,
        tpaPolicyId: cleanPolicyData.tpaPolicyId || null,
        patientInsTpaId: cleanPolicyData.patientInsTpaId || 0,
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
        waitingPeriodTill: cleanPolicyData.waitingPeriodTill || null,
        isPreCapped: cleanPolicyData.isPreCapped ?? false,
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

    const rawResponse = await updateResponse.text();
    const contentType = updateResponse.headers.get('content-type') || '';
    let updateResult: any = null;
    let parsedJson = false;

    if (rawResponse) {
      if (contentType.includes('application/json') || rawResponse.trim().startsWith('{')) {
        try {
          updateResult = JSON.parse(rawResponse);
          parsedJson = true;
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
        }
      }
    }

    if (!updateResponse.ok) {
      console.error('Failed to save policy:', parsedJson ? updateResult : rawResponse);
      return res.status(updateResponse.status || 500).json({
        error: parsedJson
          ? updateResult.head?.StatusText || 'Failed to save policy details'
          : 'Failed to save policy details',
        details: parsedJson ? updateResult : rawResponse,
      });
    }

    if (!parsedJson) {
      console.error('Unexpected non-JSON response from update endpoint:', rawResponse);
      return res.status(502).json({
        error: 'Unexpected response from update endpoint',
        details: rawResponse,
      });
    }

    console.log('Update response:', JSON.stringify(updateResult, null, 2));

    const statusValue = updateResult.head?.StatusValue;
    const isSuccess =
      statusValue === 'Success' || statusValue === 200 || statusValue === '200';
    if (!isSuccess) {
      console.error('Failed to save policy:', updateResult);
      return res.status(updateResponse.status || 500).json({
        error: updateResult.head?.StatusText || 'Failed to save policy details',
        details: updateResult,
      });
    }

    const parseId = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const extractPolicyId = (result: any, fallback: any): number | null => {
      const dataItem = Array.isArray(result?.body?.Data)
        ? result.body.Data[0]
        : result?.body?.Data;
      const candidates = [
        result?.body?.policyId,
        result?.body?.policy_id,
        result?.body?.insId,
        result?.body?.ins_id,
        result?.body?.patientInsTpaId,
        result?.body?.patient_insurance_tpa_policy_id,
        result?.body?.patient_ins_tpa_policy_id,
        dataItem?.policyId,
        dataItem?.policy_id,
        dataItem?.insId,
        dataItem?.ins_id,
        dataItem?.patientInsTpaId,
        dataItem?.patient_insurance_tpa_policy_id,
        dataItem?.patient_ins_tpa_policy_id,
      ];

      for (const candidate of candidates) {
        const parsed = parseId(candidate);
        if (parsed && parsed > 0) return parsed;
      }

      const fallbackId =
        parseId(fallback?.policyId) ?? parseId(fallback?.patientInsTpaId);
      return fallbackId && fallbackId > 0 ? fallbackId : null;
    };

    const callAsterEndpoint = async (
      endpoint: string,
      body: Record<string, unknown>,
    ) => {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
            srvseqno: '',
            reqtype: 'POST',
          },
          body,
        }),
      });

      const raw = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let parsed: any = null;
      let parsedJson = false;

      if (raw) {
        if (contentType.includes('application/json') || raw.trim().startsWith('{')) {
          try {
            parsed = JSON.parse(raw);
            parsedJson = true;
          } catch (parseError) {
            console.error(`Failed to parse response from ${endpoint}:`, parseError);
          }
        }
      }

      const statusValue = parsed?.head?.StatusValue;
      const isSuccess =
        statusValue === 'Success' || statusValue === 200 || statusValue === '200';

      if (!response.ok || !parsedJson || !isSuccess) {
        return {
          ok: false,
          data: parsedJson ? parsed : null,
          raw,
          status: response.status,
          error: parsedJson ? parsed : raw,
        };
      }

      return { ok: true, data: parsed, raw, status: response.status };
    };

    const extractEncounterId = (
      result: any,
      fallback: number | null,
    ): number | null => {
      const dataItem = Array.isArray(result?.body?.Data)
        ? result.body.Data[0]
        : result?.body?.Data;
      const candidates = [
        dataItem?.encounter_id,
        dataItem?.encounterId,
        result?.body?.encounter_id,
        result?.body?.encounterId,
      ];

      for (const candidate of candidates) {
        const parsed = parseId(candidate);
        if (parsed && parsed > 0) return parsed;
      }

      return fallback && fallback > 0 ? fallback : null;
    };

    const apntIdValue =
      parseId(appointmentId) ?? parseId(cleanPolicyData.apntId);
    const patIdValue = parseId(patientId);
    const currentPolicyId = extractPolicyId(updateResult, cleanPolicyData);

    let currentPolicyResult: any = null;
    let currentPolicyError: any = null;
    let markToBillResult: any = null;
    let markToBillError: any = null;
    if (!currentPolicyId || !patIdValue || !apntIdValue) {
      currentPolicyError = 'Missing policyId, patientId, or appointmentId';
      console.warn('Skipping current-policy call:', currentPolicyError);
    } else {
      const currentPolicyCall = await callAsterEndpoint(
        '/claim/insurance/is/current',
        {
          insId: currentPolicyId,
          isDeactivate: 0,
          patId: patIdValue,
          apntId: apntIdValue,
        },
      );
      if (currentPolicyCall.ok) {
        currentPolicyResult = currentPolicyCall.data;
      } else {
        currentPolicyError = currentPolicyCall.error;
      }

      const encounterIdValue = extractEncounterId(
        currentPolicyCall.data,
        parseId(encounterId) ?? parseId(cleanPolicyData.encounterid),
      );

      if (!encounterIdValue) {
        markToBillError = 'Missing encounterId for mark-to-bill call';
      } else {
        const markToBillCall = await callAsterEndpoint(
          '/op/order/item/ready/to/bill/add',
          {
            customerId: cleanPolicyData.customerId || 1,
            isActive: 1,
            appntId: apntIdValue,
            patientId: patIdValue,
            isbydoctor: 0,
            billItemId: 0,
            evaluationType: null,
            createdBy: cleanPolicyData.createdBy || null,
            sourceType: null,
            encounterId: encounterIdValue,
            isPackagePat: 0,
            siteId: cleanPolicyData.siteId || 31,
          },
        );
        if (markToBillCall.ok) {
          markToBillResult = markToBillCall.data;
        } else {
          markToBillError = markToBillCall.error;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Policy details saved successfully',
      data: updateResult,
      currentPolicy: currentPolicyResult,
      currentPolicyError: currentPolicyError || undefined,
      markToBill: markToBillResult,
      markToBillError: markToBillError || undefined,
    });
  } catch (error) {
    console.error('Error saving policy details:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
