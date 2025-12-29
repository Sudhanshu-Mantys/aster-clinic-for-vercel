import React, { useMemo, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import Select from "react-select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  MantysEligibilityResponse,
  TPACode,
  IDType,
  VisitType,
} from "../types/mantys";
import {
  appointmentApi,
  patientApi,
  type InsuranceData,
  type PatientData,
} from "../lib/api-client";
import { buildMantysPayload } from "../lib/mantys-utils";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { useAuth } from "../contexts/AuthContext";
import { useTPAConfigs, useDoctors } from "../hooks/useClinicConfig";
import {
  useCreateEligibilityCheck,
  useCreateEligibilityHistoryItem,
  useEligibilityHistoryItem,
} from "../hooks/useEligibility";
import {
  validateIdByType,
  validateName,
  validatePhoneNumber,
  validateDoctorName,
  validatePodId,
  validateVisitType,
  validatePayerName,
} from "../utils/form-validations";

interface MantysEligibilityFormProps {
  patientData: PatientData | null;
  insuranceData: InsuranceData | null;
  isLoadingInsurance?: boolean;
}

// Helper function to transform search-all results to MantysEligibilityResponse format
const transformResultForDisplay = (rawResult: any): MantysEligibilityResponse | null => {
  if (!rawResult) return null;

  // Check if this is a search-all result
  if (
    rawResult.is_search_all === true &&
    rawResult.aggregated_results &&
    Array.isArray(rawResult.aggregated_results)
  ) {
    // Find the eligible result from aggregated_results
    const eligibleEntry = rawResult.aggregated_results.find(
      (r: any) => r.status === "found" && r.data?.is_eligible === true
    );

    if (eligibleEntry && eligibleEntry.data) {
      // Transform to MantysEligibilityResponse format
      return {
        tpa: eligibleEntry.tpa_name || eligibleEntry.data?.payer_id || "",
        data: eligibleEntry.data,
        status: "found" as const,
        job_task_id: eligibleEntry.data?.job_task_id || rawResult.task_id || "",
        task_id: rawResult.task_id,
      } as MantysEligibilityResponse;
    }

    // No eligible result found in search-all
    return null;
  }

  // Regular (non-search-all) result
  return rawResult as MantysEligibilityResponse;
};

interface FormData {
  options: string;
  idType: string;
  visitType: string;
  emiratesId: string;
  name: string;
  phoneNumber: string;
  doctorName: string;
  referralCode: string;
  serviceType: string;
  visitCategory: string;
  isPod: boolean;
  podId: string;
  isMaternity: boolean;
  notRelatedToChiefComplaint: boolean;
  useDental: string;
  payerName: string | null;
  phoneCode: string;
  phoneSuffix: string;
  maternityType: string;
}

const INSURANCE_OPTIONS = [
  { value: "BOTH", label: "All Insurance Providers" },
  { value: "DHPO", label: "DHPO - Dubai Health Insurance" },
  { value: "RIYATI", label: "RIYATI" },
  { value: "TPA001", label: "TPA001 - Neuron" },
  { value: "TPA002", label: "TPA002 - NextCare" },
  { value: "TPA003", label: "TPA003 - Al Madallah" },
  { value: "TPA004", label: "TPA004 - NAS" },
  { value: "TPA008", label: "TPA008 - Inayah" },
  { value: "TPA010", label: "TPA010 - FMC (First Med)" },
  { value: "TPA013", label: "TPA013 - Penta" },
  { value: "TPA016", label: "TPA016 - MSH" },
  { value: "TPA021", label: "TPA021 - Vidal" },
  { value: "TPA023", label: "TPA023 - Daman Thiqa" },
  { value: "TPA025", label: "TPA025 - Sehteq" },
  { value: "TPA026", label: "TPA026 - Aafiya" },
  { value: "TPA027", label: "TPA027 - Starwell" },
  { value: "TPA029", label: "TPA029 - eCare" },
  { value: "TPA030", label: "TPA030 - Iris" },
  { value: "TPA032", label: "TPA032 - Whealth" },
  { value: "TPA036", label: "TPA036 - Mednet" },
  { value: "TPA037", label: "TPA037 - Lifeline (Khat Al Haya)" },
  { value: "TPA038", label: "TPA038 - Enet" },
  { value: "D004", label: "D004 - Daman (Variant)" },
  { value: "INS005", label: "INS005 - Dubai Insurance" },
  { value: "INS010", label: "INS010 - AXA Gulf Insurance" },
  { value: "INS012", label: "INS012 - Oman Insurance" },
  { value: "INS013", label: "INS013 - Metlife" },
  { value: "INS015", label: "INS015 - Saico" },
  { value: "INS017", label: "INS017 - ADNIC" },
  { value: "INS020", label: "INS020 - Al Buhaira" },
  { value: "INS026", label: "INS026 - Daman" },
  { value: "INS028", label: "INS028 - Interglobal" },
  { value: "INS029", label: "INS029 - Al Dhafra" },
  { value: "INS038", label: "INS038 - NGI (National General)" },
  { value: "INS041", label: "INS041 - Fidelity" },
  { value: "INS044", label: "INS044 - National Life" },
  { value: "INS053", label: "INS053 - Allianz" },
];

const BASE_ID_TYPES = [
  { label: "Emirates ID", value: "EMIRATESID" },
  { label: "Member ID", value: "CARDNUMBER" },
];

const VISIT_TYPES: Record<string, Array<{ label: string; value: string; extraArgs?: any }>> = {
  BOTH: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  DHPO: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  RIYATI: [{ label: "Outpatient", value: "OUTPATIENT" }],
  TPA001: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
    {
      label: "Maternity", value: "MATERNITY", extraArgs: {
        title: "maternity_type", titleLabel: "Maternity Type", options: [
          { label: "Normal Delivery", value: "normal_delivery" },
          { label: "C-Section", value: "c_section" },
          { label: "Prenatal", value: "prenatal" },
          { label: "Postnatal", value: "postnatal" },
        ]
      }
    },
  ],
  TPA002: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Chronic Out", value: "CHRONIC_OUT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA003: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA004: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
    {
      label: "Maternity", value: "MATERNITY", extraArgs: {
        title: "maternity_type", titleLabel: "Maternity Type", options: [
          { label: "Normal Delivery", value: "normal_delivery" },
          { label: "C-Section", value: "c_section" },
          { label: "Prenatal", value: "prenatal" },
          { label: "Postnatal", value: "postnatal" },
        ]
      }
    },
  ],
  TPA010: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA023: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA026: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA029: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  INS010: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Dental", value: "DENTAL" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  INS017: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  INS026: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  D004: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
};

const payerOptions = [
  { value: "ADNOC", label: "ADNOC Distribution" },
  { value: "EMIRATES_AIRLINE", label: "Emirates Airline" },
  { value: "ETISALAT", label: "Etisalat" },
  { value: "DU", label: "du Telecommunications" },
  { value: "RAK_BANK", label: "RAK Bank" },
  { value: "NBAD", label: "National Bank of Abu Dhabi" },
];

const visitCategoryOptions = [
  { label: "FIRST VISIT", value: "FIRST_VISIT" },
  { label: "VISIT WITHOUT REFERRAL", value: "VISIT_WITHOUT_REFERRAL" },
];

export const ModernMantysEligibilityForm: React.FC<MantysEligibilityFormProps> = ({
  patientData,
  insuranceData,
  isLoadingInsurance = false,
}) => {
  const { user } = useAuth();
  const selectedClinicId: string = user?.selected_team_id || "92d5da39-36af-4fa2-bde3-3828600d7871";
  const selectedOrganizationId: string = "aster-clinic";

  const tpaIdentifier = insuranceData?.payer_code || null;
  const { data: tpaConfigs } = useTPAConfigs(selectedClinicId, { enabled: !!selectedClinicId });
  const { data: doctorsList = [] } = useDoctors(selectedClinicId, { enabled: !!selectedClinicId });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [enrichedPatientContext, setEnrichedPatientContext] = useState<PatientData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [currentStatus, setCurrentStatus] = useState<"idle" | "pending" | "processing" | "complete">("idle");
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [mantysResponse, setMantysResponse] = useState<MantysEligibilityResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const createEligibilityCheck = useCreateEligibilityCheck();
  const createHistoryItem = useCreateEligibilityHistoryItem();

  const { data: currentHistoryItem } = useEligibilityHistoryItem(
    currentHistoryId || "",
    {
      enabled: !!currentHistoryId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "complete" || status === "error") return false;
        return 2000;
      },
    },
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      options: "BOTH",
      idType: "EMIRATESID",
      visitType: "OUTPATIENT",
      emiratesId: "",
      name: "",
      phoneNumber: "",
      doctorName: "",
      referralCode: "",
      serviceType: "",
      visitCategory: "",
      isPod: false,
      podId: "",
      isMaternity: false,
      notRelatedToChiefComplaint: false,
      useDental: "NO",
      payerName: null,
      phoneCode: "",
      phoneSuffix: "",
      maternityType: "",
    },
  });

  const watchOptions = watch("options");
  const watchIdType = watch("idType");
  const watchVisitType = watch("visitType");
  const watchIsPod = watch("isPod");

  const tpaConfig = useMemo(() => {
    if (!tpaConfigs || !tpaIdentifier) return null;
    let config = tpaConfigs.find((c: any) => c.ins_code === tpaIdentifier);
    if (!config) config = tpaConfigs.find((c: any) => c.payer_code === tpaIdentifier);
    if (!config) config = tpaConfigs.find((c: any) => c.tpa_id === tpaIdentifier);
    return config || null;
  }, [tpaConfigs, tpaIdentifier]);

  const isDoctorCompulsory = useMemo(() => {
    if (!tpaConfig) return false;
    const extraFormFields = (tpaConfig.extra_form_fields || []) as unknown as Array<{ field: string; required?: boolean }>;
    const doctorField = extraFormFields.find((field) => field.field === "doctor");
    return doctorField?.required === true;
  }, [tpaConfig]);

  const DOCTORS_LIST = useMemo(() => {
    return doctorsList
      .filter((doctor) => doctor.dha_id && doctor.dha_id.trim() !== "")
      .map((doctor) => ({
        label: `${doctor.doctor_name}${doctor.dha_id ? ` (DHA: ${doctor.dha_id})` : ""}`,
        value: doctor.dha_id || doctor.doctor_id,
      }));
  }, [doctorsList]);

  const dynamicIdTypeOptions = useMemo(() => {
    if (watchOptions === "TPA010") {
      return [...BASE_ID_TYPES, { label: "DHA Member ID", value: "DHAMEMBERID" }, { label: "Passport", value: "Passport" }];
    }
    if (["TPA037", "TPA002"].includes(watchOptions)) {
      return [...BASE_ID_TYPES, { label: "DHA Member ID", value: "DHAMEMBERID" }, { label: "Policy Number", value: "POLICYNUMBER" }];
    }
    if (["TPA001", "TPA004", "TPA036", "INS038", "INS017", "INS010"].includes(watchOptions)) {
      return [...BASE_ID_TYPES, { label: "DHA Member ID", value: "DHAMEMBERID" }];
    }
    return BASE_ID_TYPES;
  }, [watchOptions]);

  const visitTypeOptions = useMemo(() => VISIT_TYPES[watchOptions] || VISIT_TYPES["BOTH"] || [], [watchOptions]);

  const showDoctorsNameField = useMemo(() => {
    if (isDoctorCompulsory) return true;
    return (
      watchOptions === "INS026" ||
      watchOptions === "TPA029" ||
      watchOptions === "D004" ||
      watchOptions === "TPA023" ||
      watchOptions === "BOTH" ||
      watchOptions === "DHPO" ||
      watchOptions === "RIYATI"
    );
  }, [isDoctorCompulsory, watchOptions]);

  const showNameField = useMemo(() => {
    return (["TPA003", "BOTH", "RIYATI", "DHPO"].includes(watchOptions) && watchIdType !== "EMIRATESID") ||
      watchOptions === "TPA016" ||
      (watchOptions === "TPA002" && watchIdType === "POLICYNUMBER");
  }, [watchOptions, watchIdType]);

  const showPhoneField = useMemo(() => {
    return (
      watchOptions === "TPA029" ||
      watchOptions === "TPA023" ||
      watchOptions === "D004" ||
      watchOptions === "TPA037" ||
      watchOptions === "INS026"
    );
  }, [watchOptions]);

  const isOrg1Ins017 = selectedOrganizationId === "org1" && watchOptions === "INS017";
  const showVisitCategoryField = isOrg1Ins017;
  const showServiceTypeField = watchOptions === "TPA029" || (watchOptions === "TPA037" && selectedOrganizationId === "al-noor");
  const showReferralCodeField = watchOptions === "TPA026";
  const showDentalOptions = watchOptions === "INS010" && watchIdType !== "EMIRATESID";
  const showPayerNameField = watchOptions === "TPA002" && watchIdType === "POLICYNUMBER";
  const shouldShowPodFields = (watchOptions === "TPA023" || watchOptions === "INS026" || watchOptions === "D004") && selectedOrganizationId === "medcare";
  const showMaternityExtraArgs = watchVisitType === "MATERNITY" && (watchOptions === "TPA004" || watchOptions === "TPA001");

  useEffect(() => {
    if (patientData) {
      const fullName = [patientData.firstname, patientData.middlename, patientData.lastname].filter(Boolean).join(" ");
      setValue("name", fullName);
      setValue("phoneNumber", patientData.phone || "");
      if (!insuranceData && patientData.uid_value) {
        setValue("emiratesId", patientData.uid_value);
        setValue("idType", "EMIRATESID");
      }
    }
  }, [patientData, setValue, insuranceData]);

  useEffect(() => {
    if (insuranceData) {
      const isInsuranceValid = insuranceData.is_valid === 1;
      let prefilledOption: string | null = null;

      // Priority 1: Valid TPA (insurance_type === 2)
      // insurance_type: 1 = Insurance, 2 = TPA
      if (isInsuranceValid && insuranceData.insurance_type === 2 && insuranceData.receiver_code) {
        const matchingOption = INSURANCE_OPTIONS.find(opt => opt.value === insuranceData.receiver_code);
        if (matchingOption) {
          prefilledOption = matchingOption.value;
          console.log("✅ Pre-filling insurance provider from valid TPA (receiver_code):", insuranceData.receiver_code, "->", matchingOption.value);
        }
      }

      // Priority 2: Valid Insurance (insurance_type === 1, but not TPA)
      // Only use if we haven't already found a valid TPA
      if (!prefilledOption && isInsuranceValid && insuranceData.insurance_type === 1 && insuranceData.payer_code) {
        const matchingOption = INSURANCE_OPTIONS.find(opt => opt.value === insuranceData.payer_code);
        if (matchingOption) {
          prefilledOption = matchingOption.value;
          console.log("✅ Pre-filling insurance provider from valid Insurance (payer_code):", insuranceData.payer_code, "->", matchingOption.value);
        }
      }

      // Priority 3: Fallback - direct code matching (if invalid or type unknown)
      if (!prefilledOption) {
        const code = insuranceData.payer_code || insuranceData.receiver_code;
        if (code) {
          const matchingOption = INSURANCE_OPTIONS.find(opt => opt.value === code);
          if (matchingOption) {
            prefilledOption = matchingOption.value;
            console.log("✅ Pre-filling insurance provider from code (fallback):", code, "->", matchingOption.value);
          }
        }
      }

      // Priority 4: Name-based mapping (if no code match)
      if (!prefilledOption) {
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const tpaMapping: Record<string, string> = {
          Neuron: "TPA001", NextCare: "TPA002", "Al Madallah": "TPA003", NAS: "TPA004",
          "First Med": "TPA010", FMC: "TPA010", Daman: "INS026", "Daman Thiqa": "TPA023",
          AXA: "INS010", ADNIC: "INS017", Mednet: "TPA036", Oman: "INS012", Inayah: "TPA008",
          Saico: "INS015", "Saudi Arabian": "INS015", // Add SAICO mappings
        };
        const normalizedTpaName = normalize(insuranceData.tpa_name || "");
        const normalizedPayerName = normalize(insuranceData.payer_name || "");
        const mappedTpa = Object.entries(tpaMapping).find(([key]) => {
          const normalizedKey = normalize(key);
          return normalizedTpaName.includes(normalizedKey) || normalizedPayerName.includes(normalizedKey);
        });
        if (mappedTpa) {
          prefilledOption = mappedTpa[1];
          console.log("✅ Pre-filling insurance provider from name mapping:", mappedTpa[0], "->", mappedTpa[1]);
        }
      }

      // Set the prefilled option if found
      if (prefilledOption) {
        setValue("options", prefilledOption);
      }

      // Pre-fill member ID
      const memberId = insuranceData.tpa_policy_id || insuranceData.insurance_policy_id || insuranceData.policy_number || null;
      if (memberId) {
        console.log("✅ Pre-filling member ID:", memberId);
        setValue("idType", "CARDNUMBER");
        setValue("emiratesId", memberId);
      }

      // Pre-fill payer name if available
      if (insuranceData.payer_name) {
        setValue("payerName", insuranceData.payer_name);
      }
    }
  }, [insuranceData, setValue]);

  useEffect(() => {
    if (visitTypeOptions.length > 0) {
      const validVisitType = visitTypeOptions.find((opt) => opt.value === watchVisitType);
      if (!validVisitType) {
        const defaultType = visitTypeOptions.find((opt) => opt.value === "OUTPATIENT")?.value || visitTypeOptions[0]?.value;
        if (defaultType) setValue("visitType", defaultType);
      }
    }
  }, [watchOptions, visitTypeOptions, setValue, watchVisitType]);

  useEffect(() => {
    if (!currentHistoryItem) return;
    if (currentHistoryItem.status === "pending") {
      setStatusMessage("Navigating Insurance Portal...");
      setCurrentStatus("pending");
    } else if (currentHistoryItem.status === "processing") {
      setStatusMessage("Extracting eligibility data from TPA portal...");
      setCurrentStatus("processing");
    } else if (currentHistoryItem.status === "complete") {
      setStatusMessage("Eligibility check complete!");
      setCurrentStatus("complete");
      const transformedResult = transformResultForDisplay(currentHistoryItem.result);
      if (transformedResult) {
        setMantysResponse(transformedResult);
        setShowResults(true);
      }
    } else if (currentHistoryItem.status === "error") {
      setApiError(currentHistoryItem.error || "Eligibility check failed");
    }
  }, [currentHistoryItem]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setApiError(null);
    setStatusMessage("Creating eligibility check task...");
    setCurrentStatus("idle");

    try {
      let enrichedPatientData = patientData;
      if (patientData?.appointment_id && !patientData?.patient_id) {
        try {
          setStatusMessage("Fetching patient details...");
          const context = await patientApi.getContext({
            appointmentId: patientData.appointment_id?.toString(),
            mpi: patientData.mpi,
          });
          enrichedPatientData = {
            ...patientData,
            patient_id: context.patientId ? parseInt(context.patientId, 10) : patientData.patient_id,
            appointment_id: context.appointmentId ? parseInt(context.appointmentId, 10) : patientData.appointment_id,
            encounter_id: context.encounterId ? parseInt(context.encounterId, 10) : patientData.encounter_id,
          };
          setEnrichedPatientContext(enrichedPatientData);
        } catch (e) {
          console.warn("Could not fetch patient context from Redis");
        }
      }

      setStatusMessage("Creating eligibility check task...");
      let doctorDhaId: string | undefined;
      if (data.doctorName) {
        const selectedDoctor = doctorsList.find((doc) => doc.dha_id === data.doctorName || doc.doctor_id === data.doctorName);
        doctorDhaId = selectedDoctor?.dha_id || data.doctorName;
      }

      const mantysPayload = buildMantysPayload({
        idValue: data.emiratesId,
        tpaId: data.options as TPACode,
        idType: data.idType as IDType,
        visitType: data.visitType as VisitType,
        doctorName: doctorDhaId,
        payerName: undefined,
      });

      const payloadWithMetadata = {
        ...mantysPayload,
        mpi: enrichedPatientData?.mpi,
        patientId: enrichedPatientData?.patient_id,
        patientName: data.name || `${enrichedPatientData?.firstname || ""} ${enrichedPatientData?.lastname || ""}`.trim(),
        appointmentId: enrichedPatientData?.appointment_id,
        encounterId: enrichedPatientData?.encounter_id,
      };

      const response = await createEligibilityCheck.mutateAsync(payloadWithMetadata);
      const createdTaskId = response.task_id;
      if (!createdTaskId) throw new Error("No task ID received");

      setTaskId(createdTaskId);
      const actualPatientId = enrichedPatientData?.patient_id?.toString();

      const historyItem = await createHistoryItem.mutateAsync({
        clinicId: selectedClinicId,
        patientId: actualPatientId || data.emiratesId,
        taskId: createdTaskId,
        patientName: data.name || `${enrichedPatientData?.firstname || ""} ${enrichedPatientData?.lastname || ""}`.trim(),
        dateOfBirth: enrichedPatientData?.dob,
        insurancePayer: data.options,
        patientMPI: enrichedPatientData?.mpi,
        appointmentId: enrichedPatientData?.appointment_id,
        encounterId: enrichedPatientData?.encounter_id,
        status: "pending",
        pollingAttempts: 0,
      });

      setCurrentHistoryId(historyItem.id);
      setStatusMessage("Task created, monitoring status...");
      setCurrentStatus("pending");
    } catch (error: any) {
      console.error("Error submitting eligibility check:", error);
      setApiError(error.message || "Failed to check eligibility. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (showResults && mantysResponse) {
    const contextToUse = enrichedPatientContext || patientData;
    const patientFullName = contextToUse
      ? [contextToUse.firstname, contextToUse.middlename, contextToUse.lastname].filter(Boolean).join(" ")
      : undefined;
    return (
      <div className="p-4">
        <MantysResultsDisplay
          response={mantysResponse}
          onClose={() => { }}
          onCheckAnother={() => { setShowResults(false); setMantysResponse(null); }}
          patientName={patientFullName}
          patientMPI={contextToUse?.mpi}
          patientId={contextToUse?.patient_id}
          appointmentId={contextToUse?.appointment_id}
          encounterId={contextToUse?.encounter_id}
          physicianId={contextToUse?.physician_id || contextToUse?.physicianId
            ? (typeof (contextToUse?.physician_id || contextToUse?.physicianId) === 'number'
              ? (contextToUse?.physician_id || contextToUse?.physicianId)
              : parseInt(String(contextToUse?.physician_id || contextToUse?.physicianId), 10))
            : undefined}
        />
      </div>
    );
  }

  const idLabel = watchIdType === "EMIRATESID" ? "Emirates ID" : watchIdType === "DHAMEMBERID" ? "DHA Member ID" : watchIdType === "POLICYNUMBER" ? "Policy Number" : "Member ID";

  return (
    <>
      {taskId && currentStatus !== "complete" && (
        <ExtractionProgressModal
          isOpen={isSubmitting && !isMinimized}
          onClose={() => { setIsSubmitting(false); setIsMinimized(false); }}
          taskId={taskId}
          viewMode="live"
          onMinimize={() => { setIsMinimized(true); }}
          onComplete={(result) => {
            const transformedResult = transformResultForDisplay(result);
            if (transformedResult) {
              setMantysResponse(transformedResult);
              setShowResults(true);
            }
            setIsSubmitting(false);
            setIsMinimized(false);
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            {apiError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Insurance Provider</Label>
            <Controller
              name="options"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={INSURANCE_OPTIONS}
                  isSearchable
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={INSURANCE_OPTIONS.find((opt) => opt.value === field.value)}
                />
              )}
            />
          </div>

          <div>
            <Label>ID Type</Label>
            <Controller
              name="idType"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={dynamicIdTypeOptions}
                  isSearchable
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={dynamicIdTypeOptions.find((opt) => opt.value === field.value)}
                />
              )}
            />
          </div>
        </div>

        <div>
          <Label>{idLabel} <span className="text-red-500">*</span></Label>
          <Controller
            name="emiratesId"
            control={control}
            rules={{
              validate: (value) => {
                const validation = validateIdByType(value, watchIdType);
                return validation.isValid || validation.error || "Invalid ID";
              },
            }}
            render={({ field }) => (
              <Input {...field} className="mt-1" placeholder={`Enter ${idLabel}`} />
            )}
          />
          {errors.emiratesId && <p className="text-red-500 text-sm mt-1">{errors.emiratesId.message}</p>}
        </div>

        <div>
          <Label>Visit Type <span className="text-red-500">*</span></Label>
          <Controller
            name="visitType"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                options={visitTypeOptions}
                isSearchable
                className="mt-1"
                onChange={(option: any) => field.onChange(option?.value)}
                value={visitTypeOptions.find((opt) => opt.value === field.value)}
              />
            )}
          />
        </div>

        {showVisitCategoryField && (
          <div>
            <Label>Visit Category <span className="text-red-500">*</span></Label>
            <Controller
              name="visitCategory"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={visitCategoryOptions}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={visitCategoryOptions.find((opt) => opt.value === field.value)}
                />
              )}
            />
          </div>
        )}

        {showMaternityExtraArgs && (
          <div>
            <Label>Maternity Type <span className="text-red-500">*</span></Label>
            <Controller
              name="maternityType"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={[
                    { label: "Normal Delivery", value: "normal_delivery" },
                    { label: "C-Section", value: "c_section" },
                    { label: "Prenatal", value: "prenatal" },
                    { label: "Postnatal", value: "postnatal" },
                  ]}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={{ label: field.value, value: field.value } as any}
                />
              )}
            />
          </div>
        )}

        {showNameField && (
          <div>
            <Label>Name <span className="text-red-500">*</span></Label>
            <Controller
              name="name"
              control={control}
              rules={{ validate: (value) => validateName(value).isValid || "Name is required" }}
              render={({ field }) => <Input {...field} className="mt-1" placeholder="Enter patient's full name" />}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>
        )}

        {showDoctorsNameField && (
          <div>
            <Label>Doctor's Name {isDoctorCompulsory && <span className="text-red-500">*</span>}</Label>
            <Controller
              name="doctorName"
              control={control}
              rules={{ validate: (value) => isDoctorCompulsory ? validateDoctorName(value).isValid || "Doctor is required" : true }}
              render={({ field }) => (
                <Select
                  {...field}
                  options={DOCTORS_LIST}
                  isSearchable
                  isDisabled={DOCTORS_LIST.length === 0}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={DOCTORS_LIST.find((opt) => opt.value === field.value)}
                />
              )}
            />
            {errors.doctorName && <p className="text-red-500 text-sm mt-1">{errors.doctorName.message}</p>}
          </div>
        )}

        {isOrg1Ins017 ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mobile Code <span className="text-red-500">*</span></Label>
              <Controller
                name="phoneCode"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={[
                      { value: "50", label: "50" }, { value: "52", label: "52" }, { value: "54", label: "54" },
                      { value: "55", label: "55" }, { value: "56", label: "56" }, { value: "57", label: "57" }, { value: "58", label: "58" },
                    ]}
                    className="mt-1"
                    onChange={(option: any) => field.onChange(option?.value)}
                    value={{ value: field.value, label: field.value } as any}
                  />
                )}
              />
            </div>
            <div>
              <Label>Mobile Number <span className="text-red-500">*</span></Label>
              <Controller
                name="phoneSuffix"
                control={control}
                render={({ field }) => <Input {...field} className="mt-1" placeholder="7 digit number" maxLength={7} />}
              />
            </div>
          </div>
        ) : showPhoneField ? (
          <div>
            <Label>Phone Number <span className="text-red-500">*</span></Label>
            <Controller
              name="phoneNumber"
              control={control}
              rules={{ validate: (value) => validatePhoneNumber(value).isValid || "Invalid phone number" }}
              render={({ field }) => <Input {...field} className="mt-1" placeholder="971XXXXXXXXX" />}
            />
            {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber.message}</p>}
          </div>
        ) : null}

        {showServiceTypeField && (
          <div>
            <Label>Service Type</Label>
            <Controller
              name="serviceType"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={[
                    { label: "Consultation GP", value: "Consultation GP" },
                    { label: "Consultation Specialist", value: "Consultation Specialist" },
                  ]}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={field.value ? { label: field.value, value: field.value } as any : null}
                />
              )}
            />
          </div>
        )}

        {showDentalOptions && (
          <div>
            <Label>Dental</Label>
            <Controller
              name="useDental"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={[
                    { label: "Yes", value: "YES" },
                    { label: "No", value: "NO" },
                  ]}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={{ label: field.value === "YES" ? "Yes" : "No", value: field.value } as any}
                />
              )}
            />
          </div>
        )}

        {showReferralCodeField && (
          <div>
            <Label>Referral Code (optional)</Label>
            <Controller
              name="referralCode"
              control={control}
              render={({ field }) => <Input {...field} className="mt-1" placeholder="Enter referral code" />}
            />
          </div>
        )}

        {showPayerNameField && (
          <div>
            <Label>Payer Name <span className="text-red-500">*</span></Label>
            <Controller
              name="payerName"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={payerOptions}
                  className="mt-1"
                  onChange={(option: any) => field.onChange(option?.value)}
                  value={payerOptions.find((opt) => opt.value === field.value)}
                />
              )}
            />
          </div>
        )}

        {shouldShowPodFields && (
          <>
            <div className="flex items-center gap-2">
              <Controller
                name="isMaternity"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4" />
                )}
              />
              <Label className="mb-0">Maternity?</Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="notRelatedToChiefComplaint"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4" />
                )}
              />
              <Label className="mb-0">Visit not related to same chief complaint</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>POD?</Label>
                <Controller
                  name="isPod"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={[
                        { label: "Yes", value: true },
                        { label: "No", value: false },
                      ]}
                      className="mt-1"
                      onChange={(option: any) => { field.onChange(option?.value); if (option?.value === false) setValue("podId", ""); }}
                      value={{ label: field.value ? "Yes" : "No", value: field.value } as any}
                    />
                  )}
                />
              </div>
              {watchIsPod && (
                <div>
                  <Label>POD ID <span className="text-red-500">*</span></Label>
                  <Controller
                    name="podId"
                    control={control}
                    rules={{ validate: (value) => validatePodId(value).isValid || "POD ID required" }}
                    render={({ field }) => <Input {...field} className="mt-1" placeholder="Enter POD ID" />}
                  />
                  {errors.podId && <p className="text-red-500 text-sm mt-1">{errors.podId.message}</p>}
                </div>
              )}
            </div>
          </>
        )}

        <Button type="submit" disabled={isSubmitting || isLoadingInsurance} className="w-full bg-green-600 hover:bg-green-700">
          {isLoadingInsurance ? "Loading patient data..." : isSubmitting ? "Checking..." : "Check Eligibility"}
        </Button>
      </form>
    </>
  );
};
