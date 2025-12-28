import { useState, useCallback } from "react";
import {
  ApiError,
  asterApi,
  clinicConfigApi,
  patientApi,
} from "../lib/api-client";
import type {
  MantysEligibilityResponse,
  MantysKeyFields,
} from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

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
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Status Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<
    "success" | "error" | "partial"
  >("success");
  const [dialogTitle, setDialogTitle] = useState<string | undefined>(undefined);
  const [dialogMessage, setDialogMessage] = useState<string | undefined>(
    undefined,
  );
  const [dialogReqId, setDialogReqId] = useState<string | null>(null);
  const [dialogDocumentCount, setDialogDocumentCount] = useState<
    number | undefined
  >(undefined);
  const [dialogFailedCount, setDialogFailedCount] = useState<
    number | undefined
  >(undefined);
  const [dialogErrorDetails, setDialogErrorDetails] = useState<
    string | undefined
  >(undefined);

  const showDialog = useCallback(
    (params: {
      status: "success" | "error" | "partial";
      title?: string;
      message?: string;
      reqId?: string | null;
      documentCount?: number;
      failedCount?: number;
      errorDetails?: string;
    }) => {
      setDialogStatus(params.status);
      setDialogTitle(params.title);
      setDialogMessage(params.message);
      setDialogReqId(params.reqId || null);
      setDialogDocumentCount(params.documentCount);
      setDialogFailedCount(params.failedCount);
      setDialogErrorDetails(params.errorDetails);
      setDialogOpen(true);
    },
    [],
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const data = (response as any).data || response;

  const [enrichedPatientId, setEnrichedPatientId] = useState<
    number | undefined
  >(propPatientId);
  const [enrichedAppointmentId, setEnrichedAppointmentId] = useState<
    number | undefined
  >(propAppointmentId);
  const [enrichedEncounterId, setEnrichedEncounterId] = useState<
    number | undefined
  >(propEncounterId);
  const [enrichedPhysicianId, setEnrichedPhysicianId] = useState<
    number | undefined
  >(propPhysicianId);
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
          appointmentId: finalAppointmentId
            ? String(finalAppointmentId)
            : undefined,
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
        // Extract physician_id from context (can be physician_id or physicianId)
        if (context.physician_id || context.physicianId) {
          const physicianIdValue = context.physician_id || context.physicianId;
          if (physicianIdValue) {
            setEnrichedPhysicianId(
              typeof physicianIdValue === "number"
                ? physicianIdValue
                : parseInt(String(physicianIdValue), 10),
            );
            console.log(
              `✅ Fetched physician_id ${physicianIdValue} from patient context`,
            );
          }
        }
      } catch (error) {
        console.error("Error fetching patient context:", error);
      }
    }
  }, [
    patientMPI,
    propPatientId,
    propAppointmentId,
    propEncounterId,
    enrichedPatientId,
    enrichedAppointmentId,
    enrichedEncounterId,
  ]);

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

      if (
        insuranceResponse?.body?.Data &&
        Array.isArray(insuranceResponse.body.Data)
      ) {
        const selectedInsurance = insuranceResponse.body.Data.find(
          (record: any) => record.is_current === 1,
        );
        if (selectedInsurance) {
          const insTpaPatIdValue =
            selectedInsurance?.patient_insurance_tpa_policy_id_sites ||
            selectedInsurance?.patient_insurance_tpa_policy_id;
          if (insTpaPatIdValue) {
            setInsTpaPatId(Number(insTpaPatIdValue));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching insurance details:", error);
    }
  }, [
    enrichedPatientId,
    enrichedAppointmentId,
    enrichedEncounterId,
    propPatientId,
    propAppointmentId,
    propEncounterId,
  ]);

  const enrichTPAConfig = useCallback(async () => {
    if (!response.tpa) return;
    if (!clinicId) {
      console.warn("TPA config load skipped: missing clinicId.");
      return;
    }

    try {
      const configs = await clinicConfigApi.getTPA(clinicId);
      const config = configs.find(
        (c: any) =>
          c.ins_code === response.tpa ||
          c.tpa_id === response.tpa ||
          c.payer_code === response.tpa,
      );

      if (config) {
        // If config doesn't have hospital_insurance_mapping_id, try to fetch from mapping API with retry
        if (!config.hospital_insurance_mapping_id && response.tpa) {
          try {
            const mapping = await retryWithBackoff(
              () => clinicConfigApi.getTPAMapping(clinicId, response.tpa!),
              3,
              1000,
            );
            if (mapping) {
              // Merge mapping data into config
              config.hospital_insurance_mapping_id =
                mapping.hospital_insurance_mapping_id;
              config.insurance_id = mapping.insurance_id;
              config.insurance_type = mapping.insurance_type;
              config.insurance_name = mapping.insurance_name;
              config.ins_payer = mapping.ins_payer;
            }
          } catch (mappingError) {
            console.error("Failed to fetch TPA mapping after retries:", {
              tpa: response.tpa,
              clinicId,
              error:
                mappingError instanceof Error
                  ? mappingError.message
                  : String(mappingError),
            });
            // Don't throw - allow config to be used without mapping ID for now
            // The error will be caught later when trying to upload
          }
        }

        setTpaConfig(config);
        setTpaConfigLoaded(true);
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
    if (
      !keyFields.referralDocuments ||
      keyFields.referralDocuments.length === 0
    ) {
      showDialog({
        status: "error",
        title: "No Documents",
        message: "No referral documents to upload",
      });
      return;
    }

    await ensureDataLoaded();

    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (!finalPatientId || !finalAppointmentId) {
      showDialog({
        status: "error",
        title: "Missing Information",
        message: "Missing required patient information",
      });
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

        if (
          insuranceResponse?.body?.Data &&
          Array.isArray(insuranceResponse.body.Data)
        ) {
          const selectedInsurance = insuranceResponse.body.Data.find(
            (record: any) => record.is_current === 1,
          );
          if (!selectedInsurance) {
            showDialog({
              status: "error",
              title: "No Active Insurance",
              message:
                "There is no active Insurance policy for this user, please save policy first to upload files",
            });
            return;
          }
          insTpaPatIdForUpload =
            Number(
              selectedInsurance?.patient_insurance_tpa_policy_id_sites ||
                selectedInsurance?.patient_insurance_tpa_policy_id,
            ) || null;
          if (!insTpaPatIdForUpload) {
            showDialog({
              status: "error",
              title: "No Active Insurance",
              message:
                "There is no active Insurance policy for this user, please save policy first to upload files",
            });
            return;
          }
        } else {
          showDialog({
            status: "error",
            title: "No Active Insurance",
            message:
              "There is no active Insurance policy for this user, please save policy first to upload files",
          });
          return;
        }
      } catch (error) {
        showDialog({
          status: "error",
          title: "No Active Insurance",
          message:
            "There is no active Insurance policy for this user, please save policy first to upload files",
        });
        return;
      }
    }

    setUploadingFiles(true);
    const newUploadProgress: { [key: string]: number } = {};
    const newUploadedFiles: string[] = [];
    let savedReqId: string | null = null;
    let savedStatusText: string | null = null;

    try {
      // Get TPA config - use state if available, otherwise fetch directly
      let currentTpaConfig = tpaConfig;
      if (
        !currentTpaConfig?.hospital_insurance_mapping_id &&
        response.tpa &&
        clinicId
      ) {
        try {
          const configs = await clinicConfigApi.getTPA(clinicId);
          const foundConfig = configs.find(
            (c: any) =>
              c.ins_code === response.tpa ||
              c.tpa_id === response.tpa ||
              c.payer_code === response.tpa,
          );
          if (foundConfig) {
            currentTpaConfig = foundConfig;
            // If still missing mapping ID, try mapping API with retry
            if (!currentTpaConfig.hospital_insurance_mapping_id) {
              try {
                const mapping = await retryWithBackoff(
                  () => clinicConfigApi.getTPAMapping(clinicId, response.tpa!),
                  3,
                  1000,
                );
                if (mapping) {
                  currentTpaConfig.hospital_insurance_mapping_id =
                    mapping.hospital_insurance_mapping_id;
                }
              } catch (mappingError) {
                console.error("Failed to fetch TPA mapping after retries:", {
                  tpa: response.tpa,
                  clinicId,
                  error:
                    mappingError instanceof Error
                      ? mappingError.message
                      : String(mappingError),
                });
              }
            }
          }
        } catch (fetchError) {
          console.error("Failed to fetch TPA config directly:", fetchError);
        }
      }

      const configMappingId = currentTpaConfig?.hospital_insurance_mapping_id;
      const fallbackMappingId = data.patient_info?.insurance_mapping_id
        ? parseInt(data.patient_info.insurance_mapping_id, 10)
        : null;
      const insuranceMappingId = configMappingId ?? fallbackMappingId;

      if (!insuranceMappingId) {
        const diagnosticInfo = {
          responseTpa: response.tpa,
          clinicId,
          configMappingId,
          fallbackMappingId: data.patient_info?.insurance_mapping_id || null,
          tpaConfigExists: !!currentTpaConfig,
          tpaConfigHasMappingId:
            !!currentTpaConfig?.hospital_insurance_mapping_id,
          tpaConfigHasInsuranceId: currentTpaConfig?.insurance_id !== undefined,
          tpaConfigHasInsuranceName: !!currentTpaConfig?.insurance_name,
        };

        console.error("Missing insurance mapping ID:", diagnosticInfo);

        // Create detailed error message with actionable steps
        const errorMessage =
          `Missing insurance mapping ID for ${response.tpa || "unknown TPA"}.\n\n` +
          `Diagnostic Information:\n` +
          `- TPA Code: ${response.tpa}\n` +
          `- Clinic ID: ${clinicId}\n` +
          `- Config exists: ${diagnosticInfo.tpaConfigExists ? "Yes" : "No"}\n` +
          `- Has mapping ID: ${diagnosticInfo.tpaConfigHasMappingId ? "Yes" : "No"}\n` +
          `- Has insurance ID: ${diagnosticInfo.tpaConfigHasInsuranceId ? "Yes" : "No"}\n` +
          `- Has insurance name: ${diagnosticInfo.tpaConfigHasInsuranceName ? "Yes" : "No"}\n\n` +
          `To fix this issue:\n` +
          `1. Go to Clinic Configuration page\n` +
          `2. Navigate to TPA Config tab\n` +
          `3. Find or add TPA config for ${response.tpa}\n` +
          `4. Ensure it has hospital_insurance_mapping_id, insurance_id, insurance_type, and insurance_name\n` +
          `5. Use the "Bulk Import Mappings" feature if you have mapping data from API`;

        throw new Error(errorMessage);
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
          const orderResult = (await asterApi.saveEligibilityOrder({
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
          })) as any;

          console.log("Order Result:", orderResult);

          savedReqId =
            orderResult?.data?.body?.Data?.[0]?.reqid ||
            orderResult?.body?.Data?.[0]?.reqid ||
            null;
          savedStatusText =
            orderResult?.data?.body?.Data?.[0]?.status_text ||
            orderResult?.body?.Data?.[0]?.status_text ||
            "Eligibility Details Captured Successfully";
        } catch (orderError) {
          console.error("Error saving eligibility order:", orderError);

          // If eligibility order creation fails, the entire operation should fail
          let errorMessage = "Failed to create eligibility order";
          let errorDetails: string | undefined;

          if (orderError instanceof Error) {
            errorMessage = orderError.message;
            errorDetails = orderError.stack;
          } else if (orderError instanceof ApiError) {
            errorMessage = orderError.message;
            errorDetails = orderError.toString();
          }

          throw new Error(`Eligibility order creation failed: ${errorMessage}`);
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
            reqId: savedReqId, // Use reqid from order creation response
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
        showDialog({
          status: "success",
          title: savedReqId ? "Eligibility order saved" : undefined,
          reqId: savedReqId,
          documentCount: newUploadedFiles.length,
        });
      } else {
        showDialog({
          status: "partial",
          documentCount: newUploadedFiles.length,
          failedCount:
            keyFields.referralDocuments.length - newUploadedFiles.length,
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      let message = "Failed to upload documents";
      let errorDetails: string | undefined;

      if (error instanceof Error) {
        message = error.message;
        // If it's a mapping ID error, provide more context
        if (message.includes("Missing insurance mapping ID")) {
          errorDetails = error.message;
          message = "Missing insurance mapping ID";
        }
      }

      showDialog({
        status: "error",
        title: "Upload Failed",
        message,
        errorDetails,
      });
    } finally {
      setUploadingFiles(false);
    }
  }, [
    keyFields.referralDocuments,
    enrichedPatientId,
    enrichedAppointmentId,
    enrichedEncounterId,
    enrichedPhysicianId,
    insTpaPatId,
    tpaConfig,
    clinicId,
    data,
    response.tpa,
    propPatientId,
    propAppointmentId,
    propEncounterId,
    propPhysicianId,
    ensureDataLoaded,
  ]);

  const handleSavePolicy = useCallback(async () => {
    await ensureDataLoaded();

    const finalPatientId = enrichedPatientId || propPatientId;
    const finalAppointmentId = enrichedAppointmentId || propAppointmentId;
    const finalEncounterId = enrichedEncounterId || propEncounterId;

    if (!finalPatientId || !finalAppointmentId) {
      showDialog({
        status: "error",
        title: "Missing Information",
        message: "Missing required patient information",
      });
      return;
    }

    setSavingPolicy(true);

    // Define payerIdToUse outside try block so it's accessible in catch block for error logging
    const payerIdToUse = data.patient_info?.payerId
      ? typeof data.patient_info.payerId === "string"
        ? parseInt(data.patient_info.payerId, 10)
        : data.patient_info.payerId
      : data.patient_info?.payer_id
        ? typeof data.patient_info.payer_id === "string"
          ? parseInt(data.patient_info.payer_id, 10)
          : data.patient_info.payer_id
        : null;

    try {
      const siteId = tpaConfig?.lt_site_id
        ? parseInt(tpaConfig.lt_site_id, 10)
        : 31;
      const customerId = tpaConfig?.lt_customer_id
        ? parseInt(tpaConfig.lt_customer_id, 10)
        : 1;
      const createdBy = 13295;

      const insuranceMappingId = tpaConfig?.hospital_insurance_mapping_id
        ? tpaConfig.hospital_insurance_mapping_id
        : data.patient_info?.insurance_mapping_id
          ? parseInt(data.patient_info.insurance_mapping_id, 10)
          : null;

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
      showDialog({
        status: "success",
        title: "Policy Saved",
        message: "Policy details saved successfully!",
      });
      console.log("✅ Policy saved successfully:", result);
    } catch (error) {
      // Enhanced error logging with diagnostic information
      console.error("❌ Error saving policy:", {
        error,
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        context: {
          patientId: finalPatientId,
          appointmentId: finalAppointmentId,
          encounterId: finalEncounterId,
          tpaCode: response.tpa,
          hasTpaConfig: !!tpaConfig,
          insuranceMappingId:
            tpaConfig?.hospital_insurance_mapping_id ||
            data.patient_info?.insurance_mapping_id ||
            null,
          payerId: payerIdToUse,
          policyNumber:
            data.patient_info?.patient_id_info?.policy_number || null,
          memberId: data.patient_info?.patient_id_info?.member_id || null,
        },
      });

      let errorTitle = "Failed to Save Policy";
      let errorMessage = "Failed to save policy details";
      let errorDetails: string | undefined;

      if (error instanceof ApiError) {
        // Extract the specific error message from the API response
        errorMessage = error.message;

        // Try to extract more specific error from the details if available
        if (error.data && typeof error.data === "object") {
          const details = error.data as any;

          // Check if there's a more specific error message in body.Error[0].status_text
          if (details.body?.Error?.[0]?.status_text) {
            errorMessage = details.body.Error[0].status_text;
          }
          // Or check if there's an error in the details object
          else if (details.error) {
            errorMessage = String(details.error);
          }
        }

        errorDetails =
          `API Error: ${errorMessage}\n\nContext:\n` +
          `- Patient ID: ${finalPatientId}\n` +
          `- Appointment ID: ${finalAppointmentId}\n` +
          `- Encounter ID: ${finalEncounterId || "N/A"}\n` +
          `- TPA: ${response.tpa || "N/A"}\n` +
          `- Insurance Mapping ID: ${tpaConfig?.hospital_insurance_mapping_id || data.patient_info?.insurance_mapping_id || "Missing"}\n` +
          `- Payer ID: ${payerIdToUse || "N/A"}\n` +
          `- Policy Number: ${data.patient_info?.patient_id_info?.policy_number || "N/A"}\n` +
          `- Member ID: ${data.patient_info?.patient_id_info?.member_id || "N/A"}`;
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
        errorDetails =
          `${error.name}: ${error.message}\n\nStack trace:\n${error.stack || "N/A"}\n\nContext:\n` +
          `- Patient ID: ${finalPatientId}\n` +
          `- Appointment ID: ${finalAppointmentId}\n` +
          `- Encounter ID: ${finalEncounterId || "N/A"}\n` +
          `- TPA: ${response.tpa || "N/A"}\n` +
          `- Insurance Mapping ID: ${tpaConfig?.hospital_insurance_mapping_id || data.patient_info?.insurance_mapping_id || "Missing"}\n` +
          `- Payer ID: ${payerIdToUse || "N/A"}\n` +
          `- Policy Number: ${data.patient_info?.patient_id_info?.policy_number || "N/A"}\n` +
          `- Member ID: ${data.patient_info?.patient_id_info?.member_id || "N/A"}`;
      } else {
        errorDetails = `Unknown error: ${String(error)}\n\nPlease check the browser console for more details.`;
      }

      showDialog({
        status: "error",
        title: errorTitle,
        message: errorMessage,
        errorDetails,
      });
    } finally {
      setSavingPolicy(false);
    }
  }, [
    enrichedPatientId,
    enrichedAppointmentId,
    enrichedEncounterId,
    tpaConfig,
    data,
    propPatientId,
    propAppointmentId,
    propEncounterId,
    ensureDataLoaded,
  ]);

  return {
    uploadingFiles,
    savingPolicy,
    policySaved,
    uploadProgress,
    uploadedFiles,
    handleUploadScreenshots,
    handleSavePolicy,
    // Dialog state
    dialogOpen,
    dialogStatus,
    dialogTitle,
    dialogMessage,
    dialogReqId,
    dialogDocumentCount,
    dialogFailedCount,
    dialogErrorDetails,
    closeDialog,
  };
};
