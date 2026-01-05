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
  ReferralDocumentUpload,
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
  isMemberPresentAtFacility: boolean | null;
  referringPhysician: string;
  referralNo: string;
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
  DHPO: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
    { label: "Daycase", value: "DAYCASE" },
    { label: "Maternity", value: "MATERNITY" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    { label: "Psychiatry", value: "PSYCHIATRY" },
    { label: "Wellness", value: "WELLNESS" },
    { label: "Life", value: "LIFE" },
    { label: "Travel Insurance", value: "TRAVEL_INSURANCE" },
    { label: "Chronic Out", value: "CHRONIC_OUT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  RIYATI: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
    { label: "Daycase", value: "DAYCASE" },
    { label: "Maternity", value: "MATERNITY" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    { label: "Psychiatry", value: "PSYCHIATRY" },
    { label: "Wellness", value: "WELLNESS" },
    { label: "Life", value: "LIFE" },
    { label: "Travel Insurance", value: "TRAVEL_INSURANCE" },
    { label: "Chronic Out", value: "CHRONIC_OUT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  BOTH: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
    { label: "Daycase", value: "DAYCASE" },
    { label: "Maternity", value: "MATERNITY" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    { label: "Psychiatry", value: "PSYCHIATRY" },
    { label: "Wellness", value: "WELLNESS" },
    { label: "Life", value: "LIFE" },
    { label: "Travel Insurance", value: "TRAVEL_INSURANCE" },
    { label: "Chronic Out", value: "CHRONIC_OUT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  TPA003: [
    { label: "OP", value: "OUTPATIENT" },
    { label: "IP/Daycase", value: "INPATIENT" },
    { label: "Maternity", value: "MATERNITY" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    { label: "Psychiatry", value: "PSYCHIATRY" },
  ],
  TPA029: [
    { label: "Out Patient", value: "OUTPATIENT" },
    { label: "In Patient", value: "INPATIENT" },
  ],
  TPA010: [
    { label: "Out Patient", value: "OUTPATIENT" },
    { label: "In Patient", value: "INPATIENT" },
  ],
  INS038: [
    { label: "O - Out Patient", value: "OUTPATIENT" },
    { label: "I - In Patient", value: "INPATIENT" },
    { label: "D - Daycase", value: "DAYCASE" },
  ],
  TPA004: [
    { label: "OutPatient", value: "OUTPATIENT" },
    { label: "InPatient", value: "INPATIENT" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    {
      label: "Maternity",
      value: "MATERNITY",
      extraArgs: {
        title: "maternity_treatment",
        titleLabel: "Is Inpatient treatment?",
        options: [
          { label: "Yes", value: "YES" },
          { label: "No", value: "NO" },
        ],
      },
    },
    { label: "Psychiatry", value: "PSYCHIATRY" },
    { label: "Wellness", value: "WELLNESS" },
  ],
  TPA001: [
    { label: "OutPatient", value: "OUTPATIENT" },
    { label: "InPatient", value: "INPATIENT" },
    { label: "Dental", value: "DENTAL" },
    { label: "Optical", value: "OPTICAL" },
    {
      label: "Maternity",
      value: "MATERNITY",
      extraArgs: {
        title: "maternity_treatment",
        titleLabel: "Is Inpatient treatment?",
        options: [
          { label: "Yes", value: "YES" },
          { label: "No", value: "NO" },
        ],
      },
    },
    { label: "Psychiatry", value: "PSYCHIATRY" },
    { label: "Wellness", value: "WELLNESS" },
  ],
  TPA002: [
    { label: "In-Patient", value: "INPATIENT" },
    { label: "Out-Patient", value: "OUTPATIENT" },
    { label: "Dental", value: "DENTAL" },
    { label: "Life", value: "LIFE" },
    { label: "Optical", value: "OPTICAL" },
    { label: "Travel Insurance", value: "TRAVEL_INSURANCE" },
    { label: "Chronic Out", value: "CHRONIC_OUT" },
    { label: "Emergency Room Services", value: "EMERGENCY" },
    { label: "Maternity", value: "MATERNITY" },
  ],
  TPA036: [
    { label: "Out Patient", value: "OUTPATIENT" },
    { label: "Emergency (Select only in case of emergency)", value: "EMERGENCY" },
  ],
  INS026: [
    { label: "Consultation - Elective", value: "OUTPATIENT" },
    { label: "Consultation - Elective", value: "CONSULTATION_ELECTIVE" },
    { label: "Consultation - Emergency", value: "CONSULTATION_EMERGENCY" },
    { label: "Consultation - Oncology", value: "CONSULTATION_ONCOLOGY" },
    { label: "Consultation - Referral", value: "CONSULTATION_REFERRAL" },
    { label: "Consultation - Screening", value: "CONSULTATION_SCREENING" },
    { label: "Consultation - Vaccination", value: "CONSULTATION_VACCINATION" },
    { label: "In Patient", value: "INPATIENT" },
    { label: "Tele-Consultation/Telemedicine", value: "TELEHEALTH" },
    { label: "Free Follow-up (not reimbursable by the Payer)", value: "FREE_FOLLOWUP" },
    { label: "Diagnostic Testing", value: "DIAGNOSTIC" },
    { label: "Physiotherapy", value: "PHYSIOTHERAPY" },
    { label: "Dental Services", value: "DENTAL_SERVICES" },
    { label: "Pharmacy", value: "PHARMACY" },
    { label: "Homecare", value: "HOMECARE" },
    { label: "Rehabilitation", value: "REHABILITATION" },
    { label: "Daycare", value: "DAYCARE" },
    { label: "Ultrasound - First Trimester", value: "ULTRASOUND_FIRST_TRIMESTER" },
    { label: "Ultrasound - Second Trimester", value: "ULTRASOUND_SECOND_TRIMESTER" },
    { label: "Ultrasound - Third Trimester", value: "ULTRASOUND_THIRD_TRIMESTER" },
    { label: "Other OP Services", value: "OTHER_OP" },
  ],
  TPA023: [
    { label: "Consultation - Elective", value: "OUTPATIENT" },
    { label: "Consultation - Elective", value: "CONSULTATION_ELECTIVE" },
    { label: "Consultation - Emergency", value: "CONSULTATION_EMERGENCY" },
    { label: "Consultation - Oncology", value: "CONSULTATION_ONCOLOGY" },
    { label: "Consultation - Referral", value: "CONSULTATION_REFERRAL" },
    { label: "Consultation - Screening", value: "CONSULTATION_SCREENING" },
    { label: "Consultation - Vaccination", value: "CONSULTATION_VACCINATION" },
    { label: "In Patient", value: "INPATIENT" },
    { label: "Tele-Consultation/Telemedicine", value: "TELEHEALTH" },
    { label: "Free Follow-up (not reimbursable by the Payer)", value: "FREE_FOLLOWUP" },
    { label: "Diagnostic Testing", value: "DIAGNOSTIC" },
    { label: "Physiotherapy", value: "PHYSIOTHERAPY" },
    { label: "Dental Services", value: "DENTAL_SERVICES" },
    { label: "Pharmacy", value: "PHARMACY" },
    { label: "Homecare", value: "HOMECARE" },
    { label: "Rehabilitation", value: "REHABILITATION" },
    { label: "Daycare", value: "DAYCARE" },
    { label: "Ultrasound - First Trimester", value: "ULTRASOUND_FIRST_TRIMESTER" },
    { label: "Ultrasound - Second Trimester", value: "ULTRASOUND_SECOND_TRIMESTER" },
    { label: "Ultrasound - Third Trimester", value: "ULTRASOUND_THIRD_TRIMESTER" },
    { label: "Other OP Services", value: "OTHER_OP" },
    { label: "Dental Services - Capitation Program", value: "DENTAL_SERVICES_CAPITATION_PROGRAM" },
    { label: "Dental Services - Routine FFS", value: "DENTAL_SERVICES_ROUTINE_FFS" },
    { label: "Dental Services - Advanced FFS", value: "DENTAL_SERVICES_ADVANCED_FFS" },
  ],
  D004: [
    { label: "Consultation - Elective", value: "OUTPATIENT" },
    { label: "Consultation - Elective", value: "CONSULTATION_ELECTIVE" },
    { label: "Consultation - Emergency", value: "CONSULTATION_EMERGENCY" },
    { label: "Consultation - Oncology", value: "CONSULTATION_ONCOLOGY" },
    { label: "Consultation - Referral", value: "CONSULTATION_REFERRAL" },
    { label: "Consultation - Screening", value: "CONSULTATION_SCREENING" },
    { label: "Consultation - Vaccination", value: "CONSULTATION_VACCINATION" },
    { label: "In Patient", value: "INPATIENT" },
    { label: "Tele-Consultation/Telemedicine", value: "TELEHEALTH" },
    { label: "Free Follow-up (not reimbursable by the Payer)", value: "FREE_FOLLOWUP" },
    { label: "Diagnostic Testing", value: "DIAGNOSTIC" },
    { label: "Physiotherapy", value: "PHYSIOTHERAPY" },
    { label: "Dental Services", value: "DENTAL_SERVICES" },
    { label: "Pharmacy", value: "PHARMACY" },
    { label: "Homecare", value: "HOMECARE" },
    { label: "Rehabilitation", value: "REHABILITATION" },
    { label: "Daycare", value: "DAYCARE" },
    { label: "Ultrasound - First Trimester", value: "ULTRASOUND_FIRST_TRIMESTER" },
    { label: "Ultrasound - Second Trimester", value: "ULTRASOUND_SECOND_TRIMESTER" },
    { label: "Ultrasound - Third Trimester", value: "ULTRASOUND_THIRD_TRIMESTER" },
    { label: "Other OP Services", value: "OTHER_OP" },
  ],
  TPA008: [
    { label: "OP", value: "OUTPATIENT" },
    { label: "IP", value: "INPATIENT" },
  ],
  INS010: [
    { label: "DEFAULT", value: "OUTPATIENT" },
    { label: "Dental", value: "DENTAL" },
  ],
  TPA013: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA016: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA021: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA025: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA027: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA030: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA032: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA037: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  TPA038: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS005: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS012: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS013: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS015: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS017: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
    { label: "Emergency", value: "EMERGENCY" },
  ],
  INS020: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS028: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS029: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS041: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS044: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
  ],
  INS053: [
    { label: "Outpatient", value: "OUTPATIENT" },
    { label: "Inpatient", value: "INPATIENT" },
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

  // Referral Document Upload (TPA001/TPA004)
  const [referralDocument, setReferralDocument] = useState<ReferralDocumentUpload | null>(null);
  const [isReferralDocumentUploading, setIsReferralDocumentUploading] = useState(false);
  const [referralDocumentError, setReferralDocumentError] = useState<string | null>(null);

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
      isMemberPresentAtFacility: true,
      referringPhysician: "",
      referralNo: "",
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
      watchOptions === "RIYATI" ||
      watchOptions === "TPA001" ||
      watchOptions === "TPA004"
    );
  }, [isDoctorCompulsory, watchOptions]);

  // Doctor name is required for validation (not just shown)
  // For BOTH, RIYATI, DHPO - doctor field is shown but optional
  // For TPA001, TPA004 - doctor field is mandatory
  const isDoctorRequired = useMemo(() => {
    // If doctor is compulsory in config, it's required
    if (isDoctorCompulsory) {
      return true;
    }
    // TPA001, TPA004 - doctor is mandatory
    if (watchOptions === "TPA001" || watchOptions === "TPA004") {
      return true;
    }
    // BOTH, RIYATI, DHPO - doctor is optional (shown but not required)
    if (watchOptions === "BOTH" || watchOptions === "RIYATI" || watchOptions === "DHPO") {
      return false;
    }
    // For other TPAs that show the field, it's required
    return showDoctorsNameField;
  }, [isDoctorCompulsory, watchOptions, showDoctorsNameField]);

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
  const showMemberPresenceField = watchOptions === "TPA004" || watchOptions === "TPA001";
  const showReferringPhysicianField = watchOptions === "TPA001" || watchOptions === "TPA004" || watchOptions === "INS026";
  const showReferralDocumentField = watchOptions === "TPA001" || watchOptions === "TPA004";
  const showReferralNoField = watchOptions === "TPA002";

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

  // Helper functions for referral document upload
  const formatUploadTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const sanitizeIdForPath = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "unknown-id";
    return trimmed.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "-");
  };

  const uploadReferralDocument = async (file: File) => {
    if (!file) return;

    // Validate PDF only
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setReferralDocumentError("Only PDF files are allowed.");
      return;
    }

    const tpaId = watchOptions;
    const patientId = watch("emiratesId");

    if (!tpaId || tpaId === "BOTH") {
      setReferralDocumentError("Please select a specific TPA before uploading a referral document.");
      return;
    }

    if (!patientId) {
      setReferralDocumentError("Please enter an ID before uploading a referral document.");
      return;
    }

    setIsReferralDocumentUploading(true);
    setReferralDocumentError(null);

    const safeId = sanitizeIdForPath(patientId);
    const timestamp = formatUploadTimestamp();
    const extensionMatch = file.name.split(".").pop();
    const extension = extensionMatch ? extensionMatch.toLowerCase() : "pdf";
    const fileName = `${safeId}_${timestamp}.${extension}`;
    const pathPrefix = `${tpaId}/referral_documents`;

    const formData = new FormData();
    formData.append("path", pathPrefix);
    formData.append("file", file, fileName);

    try {
      const accessToken = localStorage.getItem("stack_access_token");
      const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
      const MANTYS_CLINIC_ID = process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

      const response = await fetch(
        "https://critical.api.mantys.org/v2/eligibilities-v3/upload-document",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
            "x-client-id": MANTYS_CLIENT_ID,
            "x-clinic-id": MANTYS_CLINIC_ID,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Upload failed (${response.status}): ${errorBody || response.statusText}`);
      }

      const result = await response.json();
      const url = result?.data?.url;
      const objectKey = result?.data?.object_key || `${pathPrefix}/${fileName}`;

      if (!url) {
        throw new Error("Upload succeeded but no URL was returned.");
      }

      setReferralDocument({
        url,
        objectKey,
        fileName,
        path: objectKey,
        tpaId,
        patientId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setReferralDocumentError(message);
      setReferralDocument(null);
    } finally {
      setIsReferralDocumentUploading(false);
    }
  };

  const clearReferralDocument = () => {
    setReferralDocument(null);
    setReferralDocumentError(null);
  };

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

      // Build extraArgs object
      const extraArgs: Record<string, any> = {};
      if (showMemberPresenceField && data.isMemberPresentAtFacility !== null) {
        extraArgs.is_member_present_at_the_facility = data.isMemberPresentAtFacility;
      }
      if (data.options === "TPA002" && data.referralNo) {
        extraArgs.referral_no = data.referralNo;
      }

      const mantysPayload = buildMantysPayload({
        idValue: data.emiratesId,
        tpaId: data.options as TPACode,
        idType: data.idType as IDType,
        visitType: data.visitType as VisitType,
        doctorName: doctorDhaId,
        payerName: undefined,
        referringPhysician: data.referringPhysician || undefined,
        referralDocumentUrl: referralDocument?.url || undefined,
        extraArgs: Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
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
            <Label>Doctor's Name {isDoctorRequired && <span className="text-red-500">*</span>}</Label>
            <Controller
              name="doctorName"
              control={control}
              rules={{ validate: (value) => isDoctorRequired ? validateDoctorName(value).isValid || "Doctor is required" : true }}
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

        {/* Referral Number - TPA002 (NextCare) */}
        {showReferralNoField && (
          <div>
            <Label>
              Referral Number{" "}
              <span className="text-gray-400 text-xs">(optional)</span>
            </Label>
            <Controller
              name="referralNo"
              control={control}
              rules={{
                maxLength: {
                  value: 32,
                  message: "Referral number cannot exceed 32 characters",
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  className="mt-1"
                  placeholder="Enter referral number"
                  maxLength={32}
                />
              )}
            />
            {errors.referralNo && (
              <p className="text-red-500 text-sm mt-1">
                {errors.referralNo.message}
              </p>
            )}
          </div>
        )}

        {showMemberPresenceField && (
          <div>
            <Label>Member Present at Facility <span className="text-red-500">*</span></Label>
            <Controller
              name="isMemberPresentAtFacility"
              control={control}
              rules={{
                validate: (value) =>
                  value !== null || "Please select if member is present at facility",
              }}
              render={({ field }) => {
                const isYesChecked = field.value === true;
                const isNoChecked = field.value === false;
                return (
                  <div className="mt-2 flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={isYesChecked}
                        onChange={(e) =>
                          field.onChange(e.target.checked ? true : null)
                        }
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={isNoChecked}
                        onChange={(e) =>
                          field.onChange(e.target.checked ? false : null)
                        }
                      />
                      No
                    </label>
                  </div>
                );
              }}
            />
            {errors.isMemberPresentAtFacility && (
              <p className="text-red-500 text-sm mt-1">
                {errors.isMemberPresentAtFacility.message}
              </p>
            )}
          </div>
        )}

        {/* Referring Physician - TPA001/TPA004 */}
        {showReferringPhysicianField && (
          <div>
            <Label>
              Referring Physician{" "}
              <span className="text-gray-400 text-xs">(optional)</span>
            </Label>
            <Controller
              name="referringPhysician"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  className="mt-1"
                  placeholder="Name or ID of referring physician"
                />
              )}
            />
            <p className="text-gray-500 text-xs mt-1">
              Name or ID of the referring physician (if applicable)
            </p>
          </div>
        )}

        {/* Referral Document Upload - TPA001/TPA004 */}
        {showReferralDocumentField && (
          <div>
            <Label>
              Referral Document{" "}
              <span className="text-gray-400 text-xs">(optional)</span>
            </Label>

            {/* Upload Area */}
            {!referralDocument && (
              <div className="relative mt-1">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadReferralDocument(file);
                    }
                  }}
                  disabled={isReferralDocumentUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div
                  className={`border-2 border-dashed ${
                    referralDocumentError
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300 bg-gray-50"
                  } rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors ${
                    isReferralDocumentUploading ? "opacity-50" : ""
                  }`}
                >
                  {isReferralDocumentUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="animate-spin h-8 w-8 text-blue-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span className="text-sm text-blue-600 font-medium">
                        Uploading document...
                      </span>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="mx-auto h-10 w-10 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-blue-600">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        PDF only (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Uploaded Document Display */}
            {referralDocument && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-8 w-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        {referralDocument.fileName}
                      </p>
                      <p className="text-xs text-green-700">
                        Uploaded successfully
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearReferralDocument}
                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 transition-colors"
                    title="Remove document"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {referralDocumentError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg
                    className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-800">{referralDocumentError}</p>
                </div>
              </div>
            )}
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
