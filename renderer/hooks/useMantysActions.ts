import { useState, useCallback } from "react";
import { ApiError, asterApi, clinicConfigApi, patientApi } from "../lib/api-client";
import type { MantysEligibilityResponse, MantysKeyFields } from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";

interface UseMantysActionsProps {
  clinicId?: string;
  patientMPI?: string;
  patientId?: number;
  appointmentId?: number;
  encounterId?: number;
  physicianId?: number;
  response: MantysEligibilityResponse;
}

export const useMantysActions = ({
  clinicId,
  patientMPI,
  patientId: propPatientId,
  appointmentId: propAppointmentId,
  encounterId: propEncounterId,
  physicianId: propPhysicianId,
  response,
}: UseMantysActionsProps) => {
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const data = (response as any).data || response;

  const [enrichedPatientId, setEnrichedPatientId] = useState<number | undefined>(propPatientId);
  const [enrichedAppointmentId, setEnrichedAppointmentId] = useState<number | undefined>(propAppointmentId);
  const [enrichedEncounterId, setEnrichedEncounterId] = useState<number | undefined>(propEncounterId);
  const [enrichedPhysicianId, setEnrichedPhysicianId] = useState<number | undefined>(propPhysicianId);
  const [insTpaPatId, setInsTpaPatId] = useState<number | undefined>(undefined);
  const [tpaConfig, setTpaConfig] = useState<any>(null);
  const [tpaConfigLoaded, setTpaConfigLoaded] = useState(false);

  const enrichPatientContext = useCallback(async () => {
    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (finalPatientId && finalAppointmentId) {
      setEnrichedPatientId(finalPatientId);
      setEnrichedAppointmentId(finalAppointmentId);
      setEnrichedEncounterId(finalEncounterId);
      return;
    }

    if (patientMPI || finalAppointmentId || finalPatientId) {
      try {
        const context = await patientApi.getContext({
          appointmentId: finalAppointmentId ? String(finalAppointmentId) : undefined,
          patientId: finalPatientId ? String(finalPatientId) : undefined,
          mpi: patientMPI,
        });

        if (context.patientId) {
          setEnrichedPatientId(parseInt(context.patientId, 10));
        }
        if (context.appointmentId) {
          setEnrichedAppointmentId(parseInt(context.appointmentId, 10));
        }
        if (context.encounterId !== undefined) {
          setEnrichedEncounterId(parseInt(context.encounterId, 10));
        }
      } catch (error) {
        console.error("Error fetching patient context:", error);
      }
    }
  }, [patientMPI, propPatientId, propAppointmentId, propEncounterId, enrichedPatientId, enrichedAppointmentId, enrichedEncounterId]);

  const enrichInsuranceData = useCallback(async () => {
    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (!finalPatientId || !finalAppointmentId) return;

    try {
      const insuranceResponse = await patientApi.getInsuranceDetails({
        patientId: finalPatientId,
        apntId: finalAppointmentId || null,
        encounterId: finalEncounterId || 0,
        customerId: 1,
        primaryInsPolicyId: null,
        siteId: 1,
        isDiscard: 0,
        hasTopUpCard: 0,
      });

      if (insuranceResponse?.body?.Data && Array.isArray(insuranceResponse.body.Data)) {
        const selectedInsurance = insuranceResponse.body.Data.find((record: any) => record.is_current === 1);
        if (selectedInsurance) {
          const insTpaPatIdValue = selectedInsurance?.patient_insurance_tpa_policy_id_sites || selectedInsurance?.patient_insurance_tpa_policy_id;
          if (insTpaPatIdValue) {
            setInsTpaPatId(Number(insTpaPatIdValue));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching insurance details:", error);
    }
  }, [enrichedPatientId, enrichedAppointmentId, enrichedEncounterId, propPatientId, propAppointmentId, propEncounterId]);

  const enrichTPAConfig = useCallback(async () => {
    if (!response.tpa) return;
    if (!clinicId) {
      console.warn("TPA config load skipped: missing clinicId.");
      return;
    }

    try {
      const configs = await clinicConfigApi.getTPA(clinicId);
      const config = configs.find(
        (c: any) => c.ins_code === response.tpa || c.tpa_id === response.tpa || c.payer_code === response.tpa
      );
      if (config) {
        setTpaConfig(config);
      }
    } catch (error) {
      console.error("Error fetching TPA config:", error);
    }
  }, [clinicId, response.tpa]);

  const ensureDataLoaded = useCallback(async () => {
    await enrichPatientContext();
    await enrichInsuranceData();
    await enrichTPAConfig();
  }, [enrichPatientContext, enrichInsuranceData, enrichTPAConfig]);

  const handleUploadScreenshots = useCallback(async () => {
    if (!keyFields.referralDocuments || keyFields.referralDocuments.length === 0) {
      alert("No referral documents to upload");
      return;
    }

    await ensureDataLoaded();

    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (!finalPatientId || !finalAppointmentId) {
      alert("Missing required patient information");
      return;
    }

    let insTpaPatIdForUpload = insTpaPatId || undefined;

    if (!insTpaPatIdForUpload) {
      try {
        const insuranceResponse = await patientApi.getInsuranceDetails({
          patientId: finalPatientId,
          apntId: finalAppointmentId || null,
          encounterId: finalEncounterId || 0,
          customerId: 1,
          primaryInsPolicyId: null,
          siteId: 1,
          isDiscard: 0,
          hasTopUpCard: 0,
        });

        if (insuranceResponse?.body?.Data && Array.isArray(insuranceResponse.body.Data)) {
          const selectedInsurance = insuranceResponse.body.Data.find((record: any) => record.is_current === 1);
          if (!selectedInsurance) {
            alert("There is no active Insurance policy for this user");
            return;
          }
          insTpaPatIdForUpload = Number(selectedInsurance?.patient_insurance_tpa_policy_id_sites || selectedInsurance?.patient_insurance_tpa_policy_id) || null;
          if (!insTpaPatIdForUpload) {
            alert("There is no active Insurance policy for this user");
            return;
          }
        } else {
          alert("There is no active Insurance policy for this user");
          return;
        }
      } catch (error) {
        alert("There is no active Insurance policy for this user");
        return;
      }
    }

    setUploadingFiles(true);
    const newUploadProgress: { [key: string]: number } = {};
    const newUploadedFiles: string[] = [];
    let savedReqId: string | null = null;
    let savedStatusText: string | null = null;

    try {
      const configMappingId = tpaConfig?.hospital_insurance_mapping_id;
      const fallbackMappingId = data.patient_info?.insurance_mapping_id
        ? parseInt(data.patient_info.insurance_mapping_id, 10)
        : null;
      const insuranceMappingId = configMappingId ?? fallbackMappingId;

      if (!insuranceMappingId) {
        const message = `Missing insurance mapping ID for ${response.tpa || "unknown TPA"}.`;
        console.error(message, {
          responseTpa: response.tpa,
          clinicId,
          configMappingId,
          fallbackMappingId: data.patient_info?.insurance_mapping_id || null,
        });
        throw new Error(message);
      } else {
        console.log("Saving eligibility order:", {
          responseTpa: response.tpa,
          clinicId,
          insuranceMappingId,
          insTpaPatId: insTpaPatIdForUpload,
          patientId: finalPatientId,
          appointmentId: finalAppointmentId,
          encounterId: finalEncounterId || 0,
        });
        try {
          const orderResult = await asterApi.saveEligibilityOrder({
            patientId: finalPatientId,
            appointmentId: finalAppointmentId,
            encounterId: finalEncounterId || 0,
            insuranceMappingId,
            insTpaPatId: insTpaPatIdForUpload as number,
            physicianId: enrichedPhysicianId || propPhysicianId || null,
            authorizationNumber: "",
            authorizationName: "",
            createdBy: 13295,
            vendorId: 24,
            siteId: 31,
          }) as any;

          console.log("Order Result:", orderResult);

          savedReqId = orderResult?.data?.body?.Data?.[0]?.reqid ||
            orderResult?.body?.Data?.[0]?.reqid || null;
          savedStatusText = orderResult?.data?.body?.Data?.[0]?.status_text ||
            orderResult?.body?.Data?.[0]?.status_text || "Eligibility Details Captured Successfully";
        } catch (orderError) {
          console.error("Error saving eligibility order:", orderError);
        }
      }

      for (let i = 0; i < keyFields.referralDocuments.length; i++) {
        const doc = keyFields.referralDocuments[i];
        const progressKey = `${doc.tag}_${i}`;
        newUploadProgress[progressKey] = 0;
        setUploadProgress({ ...newUploadProgress });

        try {
          await asterApi.uploadAttachment({
            patientId: finalPatientId,
            encounterId: finalEncounterId || 0,
            appointmentId: finalAppointmentId,
            insTpaPatId: insTpaPatIdForUpload as number,
            fileName: `${doc.tag.replace(/\s+/g, "_")}.pdf`,
            fileUrl: doc.s3_url,
          });
          newUploadProgress[progressKey] = 100;
          newUploadedFiles.push(doc.tag);
        } catch (uploadError) {
          console.error(`Failed to upload ${doc.tag}:`, uploadError);
          newUploadProgress[progressKey] = -1;
        }

        setUploadProgress({ ...newUploadProgress });
      }

      setUploadedFiles(newUploadedFiles);

      if (newUploadedFiles.length === keyFields.referralDocuments.length) {
        const successMessage = savedReqId
          ? `SUCCESS!\n\nEligibility order saved (Req ID: ${savedReqId})\n\nAll ${newUploadedFiles.length} documents uploaded successfully!`
          : `SUCCESS!\n\nAll ${newUploadedFiles.length} documents uploaded successfully!`;
        alert(successMessage);
      } else {
        alert(`Uploaded ${newUploadedFiles.length} out of ${keyFields.referralDocuments.length} documents`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload documents";
      alert(message);
    } finally {
      setUploadingFiles(false);
    }
  }, [keyFields.referralDocuments, enrichedPatientId, enrichedAppointmentId, enrichedEncounterId, enrichedPhysicianId, insTpaPatId, tpaConfig, clinicId, data, response.tpa, propPatientId, propAppointmentId, propEncounterId, propPhysicianId, ensureDataLoaded]);

  const handleSavePolicy = useCallback(async () => {
    await ensureDataLoaded();

    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (!finalPatientId || !finalAppointmentId) {
      alert("Missing required patient information");
      return;
    }

    setSavingPolicy(true);

    try {
      const siteId = tpaConfig?.lt_site_id ? parseInt(tpaConfig.lt_site_id, 10) : 31;
      const customerId = tpaConfig?.lt_customer_id ? parseInt(tpaConfig.lt_customer_id, 10) : 1;
      const createdBy = 13295;

      const insuranceMappingId = tpaConfig?.hospital_insurance_mapping_id
        ? tpaConfig.hospital_insurance_mapping_id
        : (data.patient_info?.insurance_mapping_id ? parseInt(data.patient_info.insurance_mapping_id, 10) : null);

      const payerIdToUse = data.patient_info?.payerId
        ? (typeof data.patient_info.payerId === "string"
          ? parseInt(data.patient_info.payerId, 10)
          : data.patient_info.payerId)
        : (data.patient_info?.payer_id
          ? (typeof data.patient_info.payer_id === "string"
            ? parseInt(data.patient_info.payer_id, 10)
            : data.patient_info.payer_id)
          : null);

      const policyData = {
        policyId: data.patient_info?.policy_id || null,
        isActive: 1,
        payerId: payerIdToUse,
        insuranceCompanyId: null,
        networkId: null,
        siteId: siteId,
        policyNumber: data.patient_info?.patient_id_info?.policy_number || null,
        insuranceGroupPolicyId: null,
        encounterid: finalEncounterId || null,
        parentInsPolicyId: null,
        tpaCompanyId: data.patient_info?.tpa_id || null,
        planName: data.patient_info?.plan_name || null,
        planCode: null,
        planId: null,
        eligibilityReqId: null,
        tpaPolicyId: data.patient_info?.patient_id_info?.member_id || null,
        insRules: null,
        orgId: null,
        insuranceMappingId: insuranceMappingId,
        tpaGroupPolicyId: null,
        apntId: finalAppointmentId,
        insuranceValidTill: data.policy_end_date || null,
        orgName: null,
        tpaValidTill: data.policy_end_date || null,
        patientId: finalPatientId,
        insuranceRenewal: null,
        payerType: 1,
        insuranceStartDate: data.policy_start_date || null,
        insurancePolicyId: null,
        hasTopUpCard: 0,
        proposerRelation: "Self",
        createdBy: createdBy,
        empId: null,
        requestLetter: null,
        insertType: 2,
        customerId: customerId,
        type: 1,
        relationshipId: 26,
        priorityPatientApplicable: 0,
        typeId: 2,
        DepData: null,
      };

      const result = await asterApi.savePolicy({
        policyData,
        patientId: finalPatientId,
        appointmentId: finalAppointmentId,
        encounterId: finalEncounterId,
        payerId: data.patient_info?.payer_id,
      });

      setPolicySaved(true);
      alert("Policy details saved successfully!");
      console.log("Policy saved:", result);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "An error occurred";
      console.error("Error saving policy:", error);
      alert(`Failed to save policy details: ${message}`);
    } finally {
      setSavingPolicy(false);
    }
  }, [enrichedPatientId, enrichedAppointmentId, enrichedEncounterId, tpaConfig, data, propPatientId, propAppointmentId, propEncounterId, ensureDataLoaded]);

  return {
    uploadingFiles,
    savingPolicy,
    policySaved,
    uploadProgress,
    uploadedFiles,
    handleUploadScreenshots,
    handleSavePolicy,
  };
};
