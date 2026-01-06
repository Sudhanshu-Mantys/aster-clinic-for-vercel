import React, { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import { Button } from "./ui/button";
import {
  MantysEligibilityResponse,
  TPACode,
  IDType,
  VisitType,
  ReferralDocumentUpload,
} from "../types/mantys";
import {
  ApiError,
  appointmentApi,
  eligibilityHistoryApi,
  patientApi,
  type EligibilityHistoryItem,
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
  validateReferralCode,
  validateVisitType,
  validateVisitCategory,
  validateMaternityType,
  validatePayerName,
  validateUAEMobileCode,
  validateUAEMobileSuffix,
  sanitizeInput,
  sanitizeNumericInput,
  sanitizeAlphanumericInput,
  formatEmiratesId,
  formatDhaMemberId,
} from "../utils/form-validations";

interface MantysEligibilityFormProps {
  patientData: PatientData | null;
  insuranceData: InsuranceData | null;
  onClose?: () => void;
  isLoadingInsurance?: boolean;
}

export const MantysEligibilityForm: React.FC<MantysEligibilityFormProps> = ({
  patientData,
  insuranceData,
  onClose,
  isLoadingInsurance = false,
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Core Form Fields
  const [options, setOptions] = useState("BOTH"); // Insurance Provider (TPA)
  const [idType, setIdType] = useState("EMIRATESID"); // ID Type
  const [visitType, setVisitType] = useState("OUTPATIENT"); // Visit Type
  const [emiratesId, setEmiratesId] = useState(""); // ID Number (Emirates ID, Member ID, etc.)

  // Additional Fields (conditional based on TPA)
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [visitCategory, setVisitCategory] = useState("");

  // POD Fields (Daman/Thiqa)
  const [isPod, setIsPod] = useState(false);
  const [podId, setPodId] = useState("");
  const [isMaternity, setIsMaternity] = useState(false);
  const [notRelatedToChiefComplaint, setNotRelatedToChiefComplaint] =
    useState(false);

  // AXA Specific
  const [useDental, setUseDental] = useState("NO");

  // NextCare Policy Number specific
  const [payerName, setPayerName] = useState<string | null>(null);

  // Referral Number (TPA002 - NextCare)
  const [referralNo, setReferralNo] = useState("");

  // Member Present at Facility (TPA004/TPA001)
  const [isMemberPresentAtFacility, setIsMemberPresentAtFacility] = useState(true);

  // Split phone for specific org (ADNIC at org1)
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSuffix, setPhoneSuffix] = useState("");

  // Maternity type
  const [maternityType, setMaternityType] = useState("");

  // Referring Physician
  const [referringPhysician, setReferringPhysician] = useState("");

  // Referral Document Upload
  const [referralDocument, setReferralDocument] = useState<ReferralDocumentUpload | null>(null);
  const [isReferralDocumentUploading, setIsReferralDocumentUploading] = useState(false);
  const [referralDocumentError, setReferralDocumentError] = useState<string | null>(null);

  // Validation & UI State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emiratesIdInputWarning, setEmiratesIdInputWarning] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Status Polling State
  const [taskId, setTaskId] = useState<string | null>(null);
  const [enrichedPatientContext, setEnrichedPatientContext] = useState<PatientData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [interimScreenshot, setInterimScreenshot] = useState<string | null>(
    null,
  );
  const [interimDocuments, setInterimDocuments] = useState<
    Array<{ id: string; tag: string; url: string }>
  >([]);
  const [currentStatus, setCurrentStatus] = useState<
    "idle" | "pending" | "processing" | "complete"
  >("idle");

  // History tracking
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const createEligibilityCheck = useCreateEligibilityCheck();
  const createHistoryItem = useCreateEligibilityHistoryItem();

  const { data: currentHistoryItem } = useEligibilityHistoryItem(
    currentHistoryId || "",
    {
      enabled: !!currentHistoryId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "complete" || status === "error") {
          return false;
        }
        return 2000;
      },
    },
  );

  // Results State
  const [mantysResponse, setMantysResponse] =
    useState<MantysEligibilityResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Organization/Clinic Context
  const { user } = useAuth();
  const selectedOrganizationId: string = "aster-clinics";
  const selectedClinicId: string = user?.selected_team_id || "92d5da39-36af-4fa2-bde3-3828600d7871";

  // TPA Config and Doctors - use TanStack Query hooks
  const tpaIdentifier = insuranceData?.payer_code || (options && options !== "BOTH" ? options : null);
  const { data: tpaConfigs, isLoading: isLoadingTPAConfig } = useTPAConfigs(selectedClinicId, { enabled: !!selectedClinicId });
  const { data: doctorsList = [], isLoading: isLoadingDoctors } = useDoctors(selectedClinicId, { enabled: !!selectedClinicId });

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

  // Previous Searches State
  const [previousSearches, setPreviousSearches] = useState<EligibilityHistoryItem[]>([]);
  const [loadingPreviousSearches, setLoadingPreviousSearches] = useState(false);

  // Fetch appointment data to get physician information and pre-fill doctor
  useEffect(() => {
    const fetchAppointmentData = async () => {
      if (patientData?.appointment_id && selectedClinicId && doctorsList.length > 0) {
        try {
          // Get today's date for the API
          const today = new Date();
          const fromDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

          const appointmentResponse = await appointmentApi.getToday({
            fromDate,
            toDate: fromDate,
          });
          const data = appointmentResponse as {
            body?: { Data?: any[] };
            appointments?: any[];
          };
          if (data.body?.Data && Array.isArray(data.body.Data)) {
            // Find the appointment matching our appointment_id
            const appointment = data.body.Data.find(
              (apt: any) => apt.appointment_id === patientData.appointment_id
            );

            if (appointment) {
              // Try to match by provider name first (most reliable)
              const providerName = appointment.provider?.trim();
              const physicianName = appointment.physician_name?.trim();
              const physicianId = appointment.physician_id;

              console.log("🔍 Looking for doctor matching:", { providerName, physicianName, physicianId });

              let matchedDoctor = null;

              // Try matching by provider name first
              if (providerName) {
                matchedDoctor = doctorsList.find(
                  (doc) => {
                    const docName = doc.doctor_name?.trim().toLowerCase() || "";
                    const provName = providerName.toLowerCase();
                    // Try exact match first
                    if (docName === provName) return true;
                    // Try partial match (remove "Dr." prefix if present)
                    const docNameClean = docName.replace(/^dr\.?\s*/i, "");
                    const provNameClean = provName.replace(/^dr\.?\s*/i, "");
                    return docNameClean === provNameClean ||
                      docName.includes(provNameClean) ||
                      provNameClean.includes(docName);
                  }
                );
              }

              // If not found, try physician_name
              if (!matchedDoctor && physicianName) {
                matchedDoctor = doctorsList.find(
                  (doc) => {
                    const docName = doc.doctor_name?.trim().toLowerCase() || "";
                    const physName = physicianName.toLowerCase();
                    return docName === physName ||
                      docName.includes(physName) ||
                      physName.includes(docName);
                  }
                );
              }

              // If still not found and we have physician_id, try matching by lt_user_id
              if (!matchedDoctor && physicianId) {
                matchedDoctor = doctorsList.find(
                  (doc) => doc.lt_user_id === physicianId.toString() || doc.doctor_id === physicianId.toString()
                );
              }

              // If found and has DHA ID, pre-fill
              if (matchedDoctor && matchedDoctor.dha_id && matchedDoctor.dha_id.trim() !== "") {
                console.log("✅ Pre-filling doctor from appointment:", matchedDoctor.doctor_name, "DHA ID:", matchedDoctor.dha_id);
                setDoctorName(matchedDoctor.dha_id);
              } else if (matchedDoctor) {
                console.log("⚠️ Found doctor but no DHA ID:", matchedDoctor.doctor_name);
              } else {
                console.log("⚠️ No matching doctor found for:", { providerName, physicianName, physicianId });
              }
            }
          } else if (data.appointments && Array.isArray(data.appointments)) {
            // Fallback to old format
            const appointment = data.appointments.find(
              (apt: any) => apt.appointment_id === patientData.appointment_id
            );

            if (appointment && appointment.physician_name) {
              const physicianName = appointment.physician_name.trim();
              const matchedDoctor = doctorsList.find(
                (doc) => doc.doctor_name?.trim().toLowerCase() === physicianName.toLowerCase()
              );

              if (matchedDoctor && matchedDoctor.dha_id && matchedDoctor.dha_id.trim() !== "") {
                console.log("✅ Pre-filling doctor from appointment (fallback):", matchedDoctor.doctor_name, "DHA ID:", matchedDoctor.dha_id);
                setDoctorName(matchedDoctor.dha_id);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch appointment data for physician:", error);
        }
      }
    };

    // Wait for doctors list to load before trying to match
    if (doctorsList.length > 0 && patientData?.appointment_id) {
      fetchAppointmentData();
    }
  }, [patientData?.appointment_id, doctorsList.length, selectedClinicId]);

  useEffect(() => {
    const loadPatientData = async () => {
      if (patientData) {
        // Pre-fill name
        const fullName = [
          patientData.firstname,
          patientData.middlename,
          patientData.lastname,
        ]
          .filter(Boolean)
          .join(" ");
        setName(fullName);

        // Pre-fill phone
        const phone =
          patientData.phone ||
          patientData.home_phone ||
          patientData.phone_other ||
          "";
        setPhoneNumber(phone);

        // Pre-fill Emirates ID from appointment Redis (nationality_id) - but only if we don't have insurance data with member ID
        // This will be overridden by insurance data if available
        if (!insuranceData) {
          let emiratesIdValue: string | null = null;

          // First, use uid_value if available (it may already contain nationality_id from appointment)
          if (patientData.uid_value && patientData.uid_value.trim()) {
            emiratesIdValue = patientData.uid_value.trim();
            console.log("✅ Using Emirates ID from patientData.uid_value:", emiratesIdValue);
          }

          // Then try to get nationality_id from appointment Redis if we have appointment_id (this will override if found)
          if (patientData.appointment_id && (!emiratesIdValue || emiratesIdValue.length === 0)) {
            try {
              const context = await patientApi.getContext({
                appointmentId: patientData.appointment_id.toString(),
                mpi: patientData.mpi,
              });

              if (context.nationality_id && context.nationality_id.trim()) {
                emiratesIdValue = context.nationality_id.trim();
                console.log("✅ Using Emirates ID from appointment Redis (nationality_id):", emiratesIdValue);
              }
            } catch (error) {
              if (error instanceof ApiError && error.status === 404) {
                console.warn("⚠️ Appointment context not found in Redis");
              } else {
                console.warn("⚠️ Could not fetch appointment context from Redis:", error);
              }
            }
          }

          // Only set if we found a value AND the field is currently empty (to avoid overwriting user input)
          if (emiratesIdValue && emiratesIdValue.length > 0 && !emiratesId) {
            setEmiratesId(emiratesIdValue);
            // Ensure ID type is set to EMIRATESID
            if (idType !== "EMIRATESID") {
              setIdType("EMIRATESID");
            }
          }
        }
      }

      if (insuranceData) {
        // Try to map insurance TPA name to options
        // This is a simplified mapping - you may need to enhance this
        const tpaMapping: Record<string, string> = {
          Neuron: "TPA001",
          NextCare: "TPA002",
          "Al Madallah": "TPA003",
          NAS: "TPA004",
          "First Med": "TPA010",
          FMC: "TPA010",
          Daman: "INS026",
          "Daman Thiqa": "TPA023",
          AXA: "INS010",
          ADNIC: "INS017",
          Mednet: "TPA036",
          Oman: "INS012",
          Inayah: "TPA008",
        };

        // Check both tpa_name and insurance_name for mapping
        const tpaName = insuranceData.tpa_name;
        const insuranceName = insuranceData.insurance_name;
        const payerName = insuranceData.payer_name;
        const receiverCode = insuranceData.receiver_code;
        const payerCode = insuranceData.payer_code;

        // First, try to map by name
        const mappedTpa = Object.entries(tpaMapping).find(([key]) => {
          const keyLower = key.toLowerCase();
          if (tpaName && tpaName.toLowerCase().includes(keyLower)) {
            return true;
          }
          if (insuranceName && insuranceName.toLowerCase().includes(keyLower)) {
            return true;
          }
          if (payerName && payerName.toLowerCase().includes(keyLower)) {
            return true;
          }
          // Also check if payer_code matches directly (e.g., INS026 for DAMAN)
          if (payerCode === "INS026" && keyLower === "daman") {
            return true;
          }
          return false;
        });

        if (mappedTpa) {
          console.log("🎯 Mapped insurance to TPA:", mappedTpa[1], "from:", { tpaName, insuranceName, payerName, payer_code: payerCode, receiver_code: receiverCode });
          setOptions(mappedTpa[1]);
        } else {
          // If no name mapping found, check codes directly
          // Priority: TPA codes > INS codes (TPA gets priority when both are available)
          const tpaCode = receiverCode?.match(/^TPA[0-9A-Z]+$/) ? receiverCode :
            payerCode?.match(/^TPA[0-9A-Z]+$/) ? payerCode : null;
          const insCode = receiverCode?.match(/^INS[0-9A-Z]+$/) ? receiverCode :
            payerCode?.match(/^INS[0-9A-Z]+$/) ? payerCode : null;
          const otherCode = receiverCode?.match(/^(D|DHPO|RIYATI)[0-9A-Z]*$/) ? receiverCode :
            payerCode?.match(/^(D|DHPO|RIYATI)[0-9A-Z]*$/) ? payerCode : null;

          // Prioritize TPA codes over INS codes
          if (tpaCode) {
            console.log("✅ Using TPA code (priority):", tpaCode, "from:", { receiver_code: receiverCode, payer_code: payerCode });
            setOptions(tpaCode);
          } else if (insCode) {
            console.log("⚠️ Using INS code (fallback):", insCode, "from:", { receiver_code: receiverCode, payer_code: payerCode });
            setOptions(insCode);
          } else if (otherCode) {
            console.log("⚠️ Using other code:", otherCode, "from:", { receiver_code: receiverCode, payer_code: payerCode });
            setOptions(otherCode);
          } else {
            console.log("❌ No valid code found in:", { receiver_code: receiverCode, payer_code: payerCode });
          }
        }

        // Pre-fill member ID if available - check multiple fields in priority order
        // Priority: tpa_policy_id > insurance_policy_id > policy_number > ins_holderid
        const memberId =
          (insuranceData.tpa_policy_id && insuranceData.tpa_policy_id.trim()) ||
          (insuranceData.insurance_policy_id && insuranceData.insurance_policy_id.trim()) ||
          (insuranceData.policy_number && insuranceData.policy_number.trim()) ||
          (insuranceData.ins_holderid && insuranceData.ins_holderid.trim()) ||
          null;

        if (memberId) {
          console.log("✅ Pre-filling member ID from insurance data:", memberId, "from fields:", {
            tpa_policy_id: insuranceData.tpa_policy_id,
            insurance_policy_id: insuranceData.insurance_policy_id,
            policy_number: insuranceData.policy_number,
            ins_holderid: insuranceData.ins_holderid
          });
          setIdType("CARDNUMBER");
          setEmiratesId(memberId);
        } else {
          // If no member ID found in insurance data, fall back to Emirates ID from appointment Redis (nationality_id)
          let emiratesIdValue: string | null = null;

          // First, use uid_value if available (it may already contain nationality_id from appointment)
          if (patientData?.uid_value) {
            emiratesIdValue = patientData.uid_value;
            console.log("✅ Using Emirates ID from patientData.uid_value:", emiratesIdValue);
          }

          // Then try to get nationality_id from appointment Redis if we have appointment_id (this will override if found)
          if (patientData?.appointment_id) {
            try {
              const context = await patientApi.getContext({
                appointmentId: patientData.appointment_id.toString(),
                mpi: patientData.mpi,
              });

              if (context.nationality_id) {
                emiratesIdValue = context.nationality_id;
                console.log("✅ Using Emirates ID from appointment Redis (nationality_id):", emiratesIdValue);
              }
            } catch (error) {
              if (error instanceof ApiError && error.status === 404) {
                console.warn("⚠️ Appointment context not found in Redis");
              } else {
                console.warn("⚠️ Could not fetch appointment context from Redis:", error);
              }
            }
          }

          // Only set Emirates ID if we found a value AND the field is currently empty or we're using EMIRATESID type
          // This prevents overwriting user input, but allows initial prefill
          if (emiratesIdValue && (idType === "EMIRATESID" || !emiratesId)) {
            setEmiratesId(emiratesIdValue);
            // Also ensure ID type is set to EMIRATESID if it's currently empty
            if (!emiratesId) {
              setIdType("EMIRATESID");
            }
          }
        }

        // Pre-fill payer name
        if (insuranceData.payer_name) {
          setPayerName(insuranceData.payer_name);
        }
      }
    };

    loadPatientData();
  }, [patientData, insuranceData, selectedClinicId]);

  // Additional effect to handle cases where uid_value becomes available after initial render
  // This handles the async Redis fetch scenario where patientData.uid_value is set later
  useEffect(() => {
    // Only update if:
    // 1. We have patientData with uid_value (non-empty)
    // 2. Emirates ID field is currently empty
    // 3. We don't have insurance data, OR insurance data exists but has no member ID
    // 4. ID type should be EMIRATESID (we'll set it if needed)
    const hasInsuranceMemberId = insuranceData && (
      (insuranceData.tpa_policy_id && insuranceData.tpa_policy_id.trim()) ||
      (insuranceData.insurance_policy_id && insuranceData.insurance_policy_id.trim()) ||
      (insuranceData.policy_number && insuranceData.policy_number.trim()) ||
      (insuranceData.ins_holderid && insuranceData.ins_holderid.trim())
    );

    if (
      patientData?.uid_value &&
      patientData.uid_value.trim() &&
      !emiratesId &&
      !hasInsuranceMemberId
    ) {
      console.log("✅ Pre-filling Emirates ID from patientData.uid_value (late update):", patientData.uid_value);
      setEmiratesId(patientData.uid_value.trim());
      // Ensure ID type is set to EMIRATESID if not already
      if (idType !== "EMIRATESID") {
        setIdType("EMIRATESID");
      }
    }
  }, [patientData?.uid_value, emiratesId, idType, insuranceData]);

  // ============================================================================
  // INSURANCE PROVIDER OPTIONS (50+ TPAs)
  // ============================================================================

  const INSURANCE_OPTIONS = [
    { value: "BOTH", label: "All Insurance Providers" },
    { value: "DHPO", label: "DHPO - Dubai Health Insurance" },
    { value: "RIYATI", label: "RIYATI" },

    // Major TPAs
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

    // Insurance Companies
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

  // ============================================================================
  // ID TYPE OPTIONS (Dynamic based on TPA)
  // ============================================================================

  const BASE_ID_TYPES = [
    { label: "Emirates ID", value: "EMIRATESID" },
    { label: "Member ID", value: "CARDNUMBER" },
  ];

  const dynamicIdTypeOptions = useMemo(() => {
    // FMC: Supports DHA Member ID and Passport
    if (options === "TPA010") {
      return [
        ...BASE_ID_TYPES,
        { label: "DHA Member ID", value: "DHAMEMBERID" },
        { label: "Passport", value: "Passport" },
      ];
    }

    // Lifeline/NextCare: Supports DHA Member ID and Policy Number
    if (["TPA037", "TPA002"].includes(options)) {
      return [
        ...BASE_ID_TYPES,
        { label: "DHA Member ID", value: "DHAMEMBERID" },
        { label: "Policy Number", value: "POLICYNUMBER" },
      ];
    }

    // Multiple TPAs: Only DHA Member ID
    if (
      ["TPA001", "TPA004", "TPA036", "INS038", "INS017", "INS010"].includes(
        options,
      )
    ) {
      return [
        ...BASE_ID_TYPES,
        { label: "DHA Member ID", value: "DHAMEMBERID" },
      ];
    }

    return BASE_ID_TYPES;
  }, [options]);

  // ============================================================================
  // VISIT TYPE OPTIONS (Dynamic based on TPA)
  // ============================================================================

  const VISIT_TYPES: Record<
    string,
    Array<{ label: string; value: string; extraArgs?: any }>
  > = {
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
    TPA026: [
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

  const visitTypeOptions = useMemo(
    () => VISIT_TYPES[options] || VISIT_TYPES["BOTH"] || [],
    [options],
  );

  // ============================================================================
  // DOCTOR LIST (from API)
  // ============================================================================

  const DOCTORS_LIST = useMemo(() => {
    return doctorsList
      .filter((doctor) => doctor.dha_id && doctor.dha_id.trim() !== "") // Only show doctors with DHA ID
      .map((doctor) => ({
        label: `${doctor.doctor_name}${doctor.dha_id ? ` (DHA: ${doctor.dha_id})` : ""}`,
        value: doctor.dha_id || doctor.doctor_id,
        doctor: doctor,
      }));
  }, [doctorsList]);

  // ============================================================================
  // PAYER OPTIONS (for NextCare Policy Number)
  // ============================================================================

  const payerOptions = {
    ADNOC: "ADNOC Distribution",
    EMIRATES_AIRLINE: "Emirates Airline",
    ETISALAT: "Etisalat",
    DU: "du Telecommunications",
    RAK_BANK: "RAK Bank",
    NBAD: "National Bank of Abu Dhabi",
  };

  // ============================================================================
  // CONDITIONAL FIELD LOGIC
  // ============================================================================

  // POD eligible locations (example for Daman/Thiqa)
  const isPodEligible = ["medcare", "healthhub"].includes(
    selectedOrganizationId,
  );
  const shouldShowPodFields =
    (options === "TPA023" || options === "INS026" || options === "D004") &&
    isPodEligible;

  // Doctor name field requirement - check config first, then fallback to hardcoded logic
  const showDoctorsNameField = useMemo(() => {
    // If doctor is compulsory in config, show the field
    if (isDoctorCompulsory) {
      return true;
    }
    // Fallback to original hardcoded logic
    return (
      options === "TPA001" || // Neuron - always required
      options === "TPA004" || // NAS - always required
      options === "INS026" || // Daman
      options === "TPA029" || // eCare
      options === "D004" || // Daman variant
      options === "TPA023" || // Daman Thiqa
      options === "BOTH" ||
      options === "DHPO" ||
      options === "RIYATI" ||
      (options === "TPA037" && selectedOrganizationId === "al-noor") || // Lifeline at Al Noor
      (options === "INS017" && selectedOrganizationId === "org1") // ADNIC at Org1
    );
  }, [isDoctorCompulsory, options, selectedOrganizationId]);

  // Doctor name is required for validation (not just shown)
  // For BOTH, RIYATI, DHPO - doctor field is shown but optional
  const isDoctorRequired = useMemo(() => {
    // If doctor is compulsory in config, it's required
    if (isDoctorCompulsory) {
      return true;
    }
    // BOTH, RIYATI, DHPO - doctor is optional (shown but not required)
    if (options === "BOTH" || options === "RIYATI" || options === "DHPO") {
      return false;
    }
    // For other TPAs that show the field, it's required
    return showDoctorsNameField;
  }, [isDoctorCompulsory, options, showDoctorsNameField]);

  // Name field requirement
  const showNameField =
    (["TPA003", "BOTH", "RIYATI", "DHPO"].includes(options) &&
      idType !== "EMIRATESID") ||
    options === "TPA016" || // MSH
    (options === "TPA002" && idType === "POLICYNUMBER"); // NextCare with Policy Number

  // Phone number field
  const showPhoneField =
    options === "TPA029" || // eCare
    options === "TPA023" || // Daman Thiqa
    options === "D004" || // Daman variant
    (options === "TPA037" && selectedOrganizationId === "al-noor") || // Lifeline at Al Noor
    options === "INS026" || // Daman
    (options === "INS010" && idType !== "EMIRATESID" && useDental === "YES"); // AXA Dental

  // Split phone fields (ADNIC at Org1)
  const isOrg1Ins017 =
    selectedOrganizationId === "org1" && options === "INS017";

  // Service type field
  const showServiceTypeField =
    options === "TPA029" || // eCare
    (options === "TPA037" && selectedOrganizationId === "al-noor"); // Lifeline at Al Noor

  // Referral code field
  const showReferralCodeField = options === "TPA026"; // Aafiya

  // AXA Dental options
  const showDentalOptions = options === "INS010" && idType !== "EMIRATESID";

  // Payer name field (NextCare with Policy Number)
  const showPayerNameField = options === "TPA002" && idType === "POLICYNUMBER";

  // Referral Number field (NextCare - TPA002)
  const showReferralNoField = options === "TPA002";

  // Referring Physician field:
  // - For TPA001, TPA004: Always show (optional)
  // - For INS026, TPA023, D004: Only show when visitType is CONSULTATION_REFERRAL (required)
  const showReferringPhysicianFieldOptional = ["TPA001", "TPA004"].includes(options);

  const showReferringPhysicianFieldRequired = useMemo(() => {
    return (
      visitType === "CONSULTATION_REFERRAL" &&
      ["INS026", "TPA023", "D004"].includes(options)
    );
  }, [visitType, options]);

  const showReferringPhysicianField = showReferringPhysicianFieldOptional || showReferringPhysicianFieldRequired;
  const isReferringPhysicianRequired = showReferringPhysicianFieldRequired;

  // Visit category (ADNIC at Org1)
  const showVisitCategoryField = isOrg1Ins017;

  const visitCategoryOptions = [
    { label: "FIRST VISIT", value: "FIRST_VISIT" },
    { label: "VISIT WITHOUT REFERRAL", value: "VISIT_WITHOUT_REFERRAL" },
  ];

  // Maternity extra args (NAS, Neuron)
  const showMaternityExtraArgs =
    visitType === "MATERNITY" && (options === "TPA004" || options === "TPA001");
  const showMemberPresenceField =
    options === "TPA004" || options === "TPA001";

  const maternityExtraArgs = visitTypeOptions?.find(
    (item) => item.value === "MATERNITY",
  )?.extraArgs;

  // ============================================================================
  // VISIT TYPE AUTO-SELECTION LOGIC
  // ============================================================================

  // Auto-select visit type when insurance provider changes
  useEffect(() => {
    if (options && VISIT_TYPES[options]) {
      let newDefaultVisitType = "OUTPATIENT";

      // Special logic for NextCare based on organization
      if (options === "TPA002") {
        if (
          ["healthhub", "medcare", "al-noor"].includes(selectedOrganizationId)
        ) {
          newDefaultVisitType = "OUTPATIENT";
        } else {
          // Use CHRONIC_OUT for other organizations
          const chronicOutOption = VISIT_TYPES[options]?.find(
            (opt) => opt.value === "CHRONIC_OUT",
          );
          newDefaultVisitType = chronicOutOption ? "CHRONIC_OUT" : "OUTPATIENT";
        }
      } else {
        // For other TPAs, use OUTPATIENT if available
        const outpatientOption = VISIT_TYPES[options]?.find(
          (opt) => opt.value === "OUTPATIENT",
        );
        newDefaultVisitType = outpatientOption
          ? "OUTPATIENT"
          : VISIT_TYPES[options][0]?.value || "OUTPATIENT";
      }

      setVisitType(newDefaultVisitType);
    }
  }, [options, selectedOrganizationId]);

  // AXA: Auto-switch to Member ID when DENTAL is selected
  useEffect(() => {
    if (options === "INS010" && visitType === "DENTAL") {
      if (idType === "EMIRATESID") {
        setIdType("CARDNUMBER"); // Switch to Member ID
      }
    }
  }, [options, visitType, idType]);

  // Helper function to fetch previous searches
  const fetchPreviousSearches = React.useCallback(async () => {
    // Try to get patientId or mpi from patientData or enriched context
    const contextToUse = enrichedPatientContext || patientData;
    const patientId = contextToUse?.patient_id;
    const mpi = contextToUse?.mpi;

    if (!patientId && !mpi) {
      setPreviousSearches([]);
      return;
    }

    setLoadingPreviousSearches(true);
    try {
      let searches: EligibilityHistoryItem[] = [];

      // Try by patientId first
      if (patientId) {
        searches = await eligibilityHistoryApi.getByPatientId(String(patientId));
      }

      // If no results and we have mpi, try by mpi
      if (searches.length === 0 && mpi) {
        searches = await eligibilityHistoryApi.getByMPI(mpi);
      }

      setPreviousSearches(searches);
    } catch (error) {
      console.error("Error fetching previous searches:", error);
      setPreviousSearches([]);
    } finally {
      setLoadingPreviousSearches(false);
    }
  }, [patientData, enrichedPatientContext]);

  // Fetch previous eligibility searches when modal opens
  useEffect(() => {
    fetchPreviousSearches();
  }, [fetchPreviousSearches]);

  // ============================================================================
  // ID NUMBER INPUT HANDLING & VALIDATION
  // ============================================================================

  const handleEmiratesIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Clear warnings
    setEmiratesIdInputWarning(null);

    // Clear error for this field
    if (errors.emiratesId) {
      setErrors({ ...errors, emiratesId: "" });
    }

    // ========== EMIRATES ID HANDLING ==========
    if (idType === "EMIRATESID") {
      const sanitized = sanitizeNumericInput(rawValue);
      const formatted = formatEmiratesId(sanitized);
      setEmiratesId(formatted);

      // Real-time validation feedback
      if (formatted.length > 0) {
        const validation = validateIdByType(formatted, idType);
        if (!validation.isValid) {
          setEmiratesIdInputWarning(validation.error);
        }
      }
    }
    // ========== DHA MEMBER ID HANDLING ==========
    else if (idType === "DHAMEMBERID") {
      const sanitized = sanitizeAlphanumericInput(rawValue);
      const formatted = formatDhaMemberId(sanitized);
      setEmiratesId(formatted);

      // Real-time validation feedback
      if (formatted.length > 0) {
        const validation = validateIdByType(formatted, idType);
        if (!validation.isValid) {
          setEmiratesIdInputWarning(validation.error);
        }
      }
    }
    // ========== OTHER ID TYPES (Member ID, Policy Number, etc.) ==========
    else {
      // Sanitize based on ID type
      let sanitized = rawValue;
      if (idType === "CARDNUMBER" || idType === "POLICYNUMBER") {
        sanitized = sanitizeAlphanumericInput(rawValue);
      } else if (idType === "Passport") {
        sanitized = sanitizeAlphanumericInput(rawValue).toUpperCase();
      }

      setEmiratesId(sanitized);

      // Real-time validation feedback
      if (sanitized.length > 0) {
        const validation = validateIdByType(sanitized, idType);
        if (!validation.isValid) {
          setEmiratesIdInputWarning(validation.error);
        }
      }
    }
  };

  // Split phone number handler (for ADNIC Org1)
  const setPhoneNumberParts = (code: string, suffix: string) => {
    setPhoneCode(code);
    setPhoneSuffix(suffix);
    setPhoneNumber(`971-${code}-${suffix}`);
  };

  // ============================================================================
  // ENHANCED INPUT HANDLERS WITH VALIDATION
  // ============================================================================

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeInput(rawValue);
    setName(sanitized);

    // Clear error for this field
    if (errors.name) {
      setErrors({ ...errors, name: "" });
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeNumericInput(rawValue);
    setPhoneNumber(sanitized);

    // Clear error for this field
    if (errors.phoneNumber) {
      setErrors({ ...errors, phoneNumber: "" });
    }
  };

  const handleDoctorNameChange = (selected: any) => {
    setDoctorName(selected?.value || "");

    // Clear error for this field
    if (errors.doctorName) {
      setErrors({ ...errors, doctorName: "" });
    }
  };

  const handleVisitTypeChange = (selected: any) => {
    setVisitType(selected?.value || "");

    // Clear error for this field
    if (errors.visitType) {
      setErrors({ ...errors, visitType: "" });
    }
  };

  const handleVisitCategoryChange = (selected: any) => {
    setVisitCategory(selected?.value || "");

    // Clear error for this field
    if (errors.visitCategory) {
      setErrors({ ...errors, visitCategory: "" });
    }
  };

  const handleMaternityTypeChange = (selected: any) => {
    setMaternityType(selected?.value || "");

    // Clear error for this field
    if (errors.maternityType) {
      setErrors({ ...errors, maternityType: "" });
    }
  };

  const handlePayerNameChange = (selected: any) => {
    setPayerName(selected?.value || null);

    // Clear error for this field
    if (errors.payerName) {
      setErrors({ ...errors, payerName: "" });
    }
  };

  const handlePodIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeAlphanumericInput(rawValue);
    setPodId(sanitized);

    // Clear error for this field
    if (errors.pod) {
      setErrors({ ...errors, pod: "" });
    }
  };

  const handleReferralCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeAlphanumericInput(rawValue);
    setReferralCode(sanitized);
  };

  const handleReferringPhysicianChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeInput(rawValue);
    setReferringPhysician(sanitized);

    // Clear error for this field
    if (errors.referringPhysician) {
      setErrors({ ...errors, referringPhysician: "" });
    }
  };

  const handleReferralNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Limit to 32 characters
    const sanitized = sanitizeAlphanumericInput(rawValue).slice(0, 32);
    setReferralNo(sanitized);
  };

  // ============================================================================
  // REFERRAL DOCUMENT UPLOAD
  // ============================================================================

  const formatUploadTimestamp = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  };

  const sanitizeIdForPath = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "unknown-id";
    return trimmed.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "-");
  };

  const uploadReferralDocument = async (file: File) => {
    if (!file) {
      return;
    }

    // Validate PDF only
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setReferralDocumentError("Only PDF files are allowed.");
      return;
    }

    const tpaId = options;
    const patientId = emiratesId;

    if (!tpaId || tpaId === "BOTH") {
      setReferralDocumentError(
        "Please select a specific TPA before uploading a referral document."
      );
      return;
    }

    if (!patientId) {
      setReferralDocumentError(
        "Please enter an ID before uploading a referral document."
      );
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

    // Use browser's native FormData - same as extension
    const formData = new FormData();
    formData.append("path", pathPrefix);
    formData.append("file", file, fileName);

    try {
      // Get bearer token from localStorage - same as extension
      const accessToken = localStorage.getItem("stack_access_token");
      const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
      const MANTYS_CLINIC_ID =
        process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

      // Upload directly to Mantys API - same as extension
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
        throw new Error(
          `Upload failed (${response.status}): ${errorBody || response.statusText}`
        );
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
      const message =
        error instanceof Error ? error.message : "Upload failed.";
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

  const handlePhoneCodeChange = (selected: any) => {
    const code = selected?.value || "";
    setPhoneNumberParts(code, phoneSuffix);

    // Clear error for this field
    if (errors.phoneNumber) {
      setErrors({ ...errors, phoneNumber: "" });
    }
  };

  const handlePhoneSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeNumericInput(rawValue).slice(0, 7);
    setPhoneNumberParts(phoneCode, sanitized);

    // Clear error for this field
    if (errors.phoneNumber) {
      setErrors({ ...errors, phoneNumber: "" });
    }
  };

  // ============================================================================
  // FORM VALIDATION
  // ============================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Emirates ID / Member ID validation using comprehensive utility
    const idValidation = validateIdByType(emiratesId, idType);
    if (!idValidation.isValid) {
      newErrors.emiratesId = idValidation.error || "Invalid ID";
    }

    // Visit type validation
    const visitTypeValidation = validateVisitType(visitType);
    if (!visitTypeValidation.isValid) {
      newErrors.visitType = visitTypeValidation.error || "Visit type is required";
    }

    // Doctor name validation - only validate if required (not just shown)
    if (isDoctorRequired) {
      const doctorValidation = validateDoctorName(doctorName);
      if (!doctorValidation.isValid) {
        newErrors.doctorName = doctorValidation.error || "Doctor name is required";
      }

      // DHA ID validation when doctor is compulsory
      if (isDoctorCompulsory && doctorName) {
        const selectedDoctor = doctorsList.find(
          (doc) => doc.dha_id === doctorName || doc.doctor_id === doctorName
        );
        if (!selectedDoctor || !selectedDoctor.dha_id || selectedDoctor.dha_id.trim() === "") {
          newErrors.doctorName = "Selected doctor must have a DHA ID";
        }
      }
    }

    // Name validation
    if (showNameField) {
      const nameValidation = validateName(name);
      if (!nameValidation.isValid) {
        newErrors.name = nameValidation.error || "Name is required";
      }
    }

    // Phone validation
    if (showPhoneField) {
      if (isOrg1Ins017) {
        // Split phone validation for ADNIC Org1
        const codeValidation = validateUAEMobileCode(phoneCode);
        const suffixValidation = validateUAEMobileSuffix(phoneSuffix);

        if (!codeValidation.isValid) {
          newErrors.phoneNumber = codeValidation.error || "Invalid mobile code";
        } else if (!suffixValidation.isValid) {
          newErrors.phoneNumber = suffixValidation.error || "Invalid mobile number";
        }
      } else {
        // Regular phone validation
        const phoneValidation = validatePhoneNumber(phoneNumber);
        if (!phoneValidation.isValid) {
          newErrors.phoneNumber = phoneValidation.error || "Phone number is required";
        }
      }
    }

    // POD validation
    if (shouldShowPodFields && isPod) {
      const podValidation = validatePodId(podId);
      if (!podValidation.isValid) {
        newErrors.pod = podValidation.error || "POD ID is required";
      }
    }

    // Payer name validation (NextCare Policy Number)
    if (showPayerNameField) {
      const payerValidation = validatePayerName(payerName || "");
      if (!payerValidation.isValid) {
        newErrors.payerName = payerValidation.error || "Payer name is required";
      }
    }

    // Visit category validation (ADNIC Org1)
    if (showVisitCategoryField) {
      const categoryValidation = validateVisitCategory(visitCategory);
      if (!categoryValidation.isValid) {
        newErrors.visitCategory = categoryValidation.error || "Visit category is required";
      }
    }

    // Member Presence at Facility validation (TPA004/TPA001)
    if (
      ["TPA001", "TPA004", "C001", "C005", "BOTH", "RIYATI", "DHPO"].includes(
        options,
      ) &&
      isMemberPresentAtFacility === null
    ) {
      newErrors.memberPresence = "Please select if member is present at facility";
    }

    // Referral code validation (optional field, but validate if present)
    if (referralCode) {
      const referralValidation = validateReferralCode(referralCode);
      if (!referralValidation.isValid) {
        newErrors.referralCode = referralValidation.error || "Invalid referral code";
      }
    }

    // Referring Physician validation - REQUIRED for CONSULTATION_REFERRAL with Daman TPAs
    if (isReferringPhysicianRequired && !referringPhysician.trim()) {
      newErrors.referringPhysician = "Referring physician ID is required for referral visits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  useEffect(() => {
    if (!currentHistoryItem) {
      return;
    }

    setPollingAttempts(currentHistoryItem.pollingAttempts || 0);

    if (currentHistoryItem.status === "pending") {
      setStatusMessage("Navigating Insurance Portal...");
      setCurrentStatus("pending");
      return;
    }

    if (currentHistoryItem.status === "processing") {
      setStatusMessage("Extracting eligibility data from TPA portal...");
      setCurrentStatus("processing");

      if (currentHistoryItem.interimResults) {
        if (currentHistoryItem.interimResults.screenshot) {
          setInterimScreenshot(currentHistoryItem.interimResults.screenshot);
        }
        if (currentHistoryItem.interimResults.documents) {
          setInterimDocuments(
            currentHistoryItem.interimResults.documents.map((doc: any) => ({
              id: doc.name,
              tag: doc.type,
              url: doc.url,
            })),
          );
        }
      }

      return;
    }

    if (currentHistoryItem.status === "complete") {
      setStatusMessage("Eligibility check complete!");
      setCurrentStatus("complete");
      setMantysResponse(currentHistoryItem.result as MantysEligibilityResponse);
      setShowResults(true);
      setIsMinimized(false);
      return;
    }

    if (currentHistoryItem.status === "error") {
      setApiError(currentHistoryItem.error || "Eligibility check failed");
      setIsMinimized(false);
    }
  }, [currentHistoryItem]);

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    setStatusMessage("Creating eligibility check task...");
    setPollingAttempts(0);
    setInterimScreenshot(null);
    setInterimDocuments([]);
    setCurrentStatus("idle");

    try {
      // If we have appointment ID but not patient ID, fetch from Redis
      let enrichedPatientData = patientData;
      if (patientData?.appointment_id && !patientData?.patient_id) {
        try {
          setStatusMessage("Fetching patient details...");
          const context = await patientApi.getContext({
            appointmentId: patientData.appointment_id?.toString(),
            mpi: patientData.mpi,
            patientId: patientData.patient_id ? String(patientData.patient_id) : undefined,
          });

          enrichedPatientData = {
            ...patientData,
            patient_id: context.patientId ? parseInt(context.patientId, 10) : patientData.patient_id,
            appointment_id: context.appointmentId ? parseInt(context.appointmentId, 10) : patientData.appointment_id,
            encounter_id: context.encounterId ? parseInt(context.encounterId, 10) : patientData.encounter_id,
          };
          setEnrichedPatientContext(enrichedPatientData);
          console.log("✅ Enriched patient data from Redis:", enrichedPatientData);
        } catch (redisError) {
          if (redisError instanceof ApiError && redisError.status === 404) {
            console.warn("⚠️ Patient context not found in Redis");
          } else {
            console.warn("⚠️ Could not fetch patient context from Redis:", redisError);
          }
          // Continue with existing data
        }
      }

      setStatusMessage("Creating eligibility check task...");

      // Get doctor DHA ID if doctor is compulsory
      let doctorDhaId: string | undefined = undefined;
      if (isDoctorCompulsory && doctorName) {
        const selectedDoctor = doctorsList.find(
          (doc) => doc.dha_id === doctorName || doc.doctor_id === doctorName
        );
        if (selectedDoctor && selectedDoctor.dha_id) {
          doctorDhaId = selectedDoctor.dha_id;
        } else {
          throw new Error("Selected doctor must have a DHA ID");
        }
      } else if (doctorName) {
        // For non-compulsory cases, try to find DHA ID if available
        const selectedDoctor = doctorsList.find(
          (doc) => doc.dha_id === doctorName || doc.doctor_id === doctorName
        );
        if (selectedDoctor && selectedDoctor.dha_id) {
          doctorDhaId = selectedDoctor.dha_id;
        } else {
          // Fallback to doctorName if no DHA ID found
          doctorDhaId = doctorName;
        }
      }

      // Build extraArgs object
      const extraArgs: Record<string, any> = {};
      if (showMemberPresenceField && isMemberPresentAtFacility !== null) {
        extraArgs.is_member_present_at_the_facility = isMemberPresentAtFacility;
      }
      if (options === "TPA002" && referralNo) {
        extraArgs.referral_no = referralNo;
      }

      // Build Mantys payload according to API specification
      const mantysPayload = buildMantysPayload({
        idValue: emiratesId,
        tpaId: options as TPACode,
        idType: idType as IDType,
        visitType: visitType as VisitType,
        doctorName: doctorDhaId || doctorName || undefined,
        payerName: undefined,
        referringPhysician: referringPhysician || undefined,
        referralDocumentUrl: referralDocument?.url || undefined,
        extraArgs: Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
      });

      // Add patient metadata for Redis enrichment (use enriched data if available)
      const payloadWithMetadata = {
        ...mantysPayload,
        mpi: enrichedPatientData?.mpi,
        patientId: enrichedPatientData?.patient_id,
        patientName: enrichedPatientData ? `${enrichedPatientData.firstname} ${enrichedPatientData.lastname}`.trim() : name || undefined,
        appointmentId: enrichedPatientData?.appointment_id,
        encounterId: enrichedPatientData?.encounter_id,
      };

      console.log("Submitting eligibility check to Mantys:", payloadWithMetadata);

      // Step 1: Create the task
      const data = await createEligibilityCheck.mutateAsync(
        payloadWithMetadata,
      );
      const createdTaskId = data.task_id;

      if (!createdTaskId) {
        throw new Error("No task ID received from server");
      }

      console.log("Task created with ID:", createdTaskId);
      setTaskId(createdTaskId);
      setStatusMessage("Task created, checking status...");

      const actualPatientId = enrichedPatientData?.patient_id?.toString();

      const historyItem = await createHistoryItem.mutateAsync({
        clinicId: selectedClinicId,
        patientId: actualPatientId || emiratesId,
        taskId: createdTaskId,
        patientName:
          name ||
          `${enrichedPatientData?.firstname || ""} ${enrichedPatientData?.lastname || ""}`.trim() ||
          undefined,
        dateOfBirth: enrichedPatientData?.dob || undefined,
        insurancePayer: options,
        patientMPI: enrichedPatientData?.mpi || undefined,
        appointmentId: enrichedPatientData?.appointment_id || undefined,
        encounterId: enrichedPatientData?.encounter_id || undefined,
        status: "pending",
        pollingAttempts: 0,
      });

      console.log("📝 Saved to history with patient ID:", actualPatientId || emiratesId);
      setCurrentHistoryId(historyItem.id);
      setStatusMessage("Task created, monitoring status...");
      setCurrentStatus("pending");

      // Refresh previous searches after successful submission
      // Wait a bit for Redis to be updated
      setTimeout(() => {
        fetchPreviousSearches();
      }, 1000);
    } catch (error: any) {
      console.error("Error submitting eligibility check:", error);
      setApiError(
        error.message || "Failed to check eligibility. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const handleCheckAnother = () => {
    setShowResults(false);
    setMantysResponse(null);
    setApiError(null);
    setEnrichedPatientContext(null);
    // Reset form to initial state
    setEmiratesId("");
    setVisitType("OUTPATIENT");
    setIsMemberPresentAtFacility(true);
    // Reset referring physician and document states
    setReferringPhysician("");
    setReferralDocument(null);
    setReferralDocumentError(null);
    // Reset referral number (TPA002)
    setReferralNo("");
    // Reset extraction states
    setInterimScreenshot(null);
    setInterimDocuments([]);
    setCurrentStatus("idle");
    setCurrentHistoryId(null);
    setStatusMessage("");
    setPollingAttempts(0);
    setTaskId(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // If results are available, show the results display
  if (showResults && mantysResponse) {
    // Use enriched context if available, otherwise use original patientData
    const contextToUse = enrichedPatientContext || patientData;

    const patientFullName = contextToUse
      ? [contextToUse.firstname, contextToUse.middlename, contextToUse.lastname].filter(Boolean).join(" ")
      : undefined;

    return (
      <MantysResultsDisplay
        response={mantysResponse}
        onClose={onClose}
        onCheckAnother={handleCheckAnother}
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
    );
  }

  return (
    <>
      {/* Extraction Progress Modal */}
      {taskId && (
        <ExtractionProgressModal
          isOpen={isSubmitting && !isMinimized}
          onClose={() => {
            setIsSubmitting(false);
            setIsMinimized(false);
          }}
          onMinimize={() => {
            setIsMinimized(true);
          }}
          taskId={taskId}
          viewMode="live"
          onComplete={(result) => {
            setMantysResponse(result);
            setShowResults(true);
            setIsMinimized(false);
          }}
        />
      )}

      <div className="space-y-6 p-4 sm:p-6">
        {/* Loading Indicator for Config/Doctor Loading */}
        {(isLoadingTPAConfig || isLoadingDoctors) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
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
              <span className="text-sm text-blue-800 font-medium">
                Loading eligibility options...
              </span>
            </div>
          </div>
        )}

        {/* API Error Display */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5"
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
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 mb-1">
                  Error
                </h3>
                <p className="text-sm text-red-800">{apiError}</p>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}


        {/* Form Fields */}
        <div>
          <div className="space-y-4">
            {/* Insurance Provider */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                Insurance Provider
              </label>
              <Select
                value={INSURANCE_OPTIONS.find((opt) => opt.value === options)}
                onChange={(selected) => setOptions(selected?.value || "BOTH")}
                options={INSURANCE_OPTIONS}
                placeholder="Select an insurance provider"
                isSearchable
              />
            </div>

            {/* ID Type and Visit Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  ID Type
                </label>
                <Select
                  value={dynamicIdTypeOptions.find(
                    (opt) => opt.value === idType,
                  )}
                  onChange={(selected) =>
                    setIdType(selected?.value || "EMIRATESID")
                  }
                  options={dynamicIdTypeOptions}
                  placeholder="Select ID type"
                  isSearchable
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Visit Type <span className="text-red-600">*</span>
                </label>
                <Select
                  value={visitTypeOptions.find(
                    (opt) => opt.value === visitType,
                  )}
                  onChange={handleVisitTypeChange}
                  options={visitTypeOptions}
                  placeholder={
                    visitTypeOptions.length > 0
                      ? "Select visit type"
                      : "TPA has no visit type"
                  }
                  isDisabled={visitTypeOptions.length === 0}
                  isSearchable
                />
                {errors.visitType && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.visitType}
                  </span>
                )}
              </div>
            </div>

            {/* Visit Category (ADNIC at Org1) */}
            {showVisitCategoryField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Visit Category <span className="text-red-600">*</span>
                </label>
                <Select
                  value={visitCategoryOptions.find(
                    (opt) => opt.value === visitCategory,
                  )}
                  onChange={handleVisitCategoryChange}
                  options={visitCategoryOptions}
                  placeholder="Select visit category"
                />
                {errors.visitCategory && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.visitCategory}
                  </span>
                )}
              </div>
            )}

            {/* Maternity Extra Args (NAS, Neuron) */}
            {showMaternityExtraArgs && maternityExtraArgs && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  {maternityExtraArgs.titleLabel}{" "}
                  <span className="text-red-600">*</span>
                </label>
                <Select
                  value={maternityExtraArgs.options.find(
                    (opt: any) => opt.value === maternityType,
                  )}
                  onChange={handleMaternityTypeChange}
                  options={maternityExtraArgs.options}
                  placeholder="Select maternity type"
                  isSearchable
                />
                {errors.maternityType && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.maternityType}
                  </span>
                )}
              </div>
            )}

            {showMemberPresenceField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Member Present at Facility <span className="text-red-600">*</span>
                </label>
                <div className="mt-2 flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={isMemberPresentAtFacility === true}
                      onChange={(e) =>
                        setIsMemberPresentAtFacility(
                          e.target.checked ? true : false
                        )
                      }
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={isMemberPresentAtFacility === false}
                      onChange={(e) =>
                        setIsMemberPresentAtFacility(
                          e.target.checked ? false : true
                        )
                      }
                    />
                    No
                  </label>
                </div>
                {errors.memberPresence && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.memberPresence}
                  </span>
                )}
              </div>
            )}

            {/* Name Field (Al Madallah, DHPO, RIYATI, MSH, NextCare Policy) */}
            {showNameField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Enter patient's full name"
                  maxLength={100}
                  className={`w-full border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.name && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.name}
                  </span>
                )}
                <small className="text-gray-500 mt-1 block">
                  Full name as per Emirates ID or official documents
                </small>
              </div>
            )}

            {/* Doctor Name */}
            {showDoctorsNameField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Doctor's Name {isDoctorRequired && <span className="text-red-600">*</span>}
                </label>
                <Select
                  value={DOCTORS_LIST.find((opt) => opt.value === doctorName)}
                  onChange={handleDoctorNameChange}
                  options={DOCTORS_LIST}
                  placeholder="Select doctor's name"
                  isSearchable
                  isDisabled={DOCTORS_LIST.length === 0}
                />
                {doctorName && (() => {
                  const selectedDoctor = doctorsList.find(
                    (doc) => doc.dha_id === doctorName || doc.doctor_id === doctorName
                  );
                  return selectedDoctor?.dha_id ? (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <span className="font-medium text-blue-900">DHA ID: </span>
                      <span className="text-blue-700">{selectedDoctor.dha_id}</span>
                    </div>
                  ) : null;
                })()}
                {errors.doctorName && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.doctorName}
                  </span>
                )}
                {isDoctorCompulsory && DOCTORS_LIST.length === 0 && (
                  <span className="text-orange-600 text-sm mt-1 block">
                    ⚠️ No doctors with DHA ID available. Please configure doctors with DHA ID in clinic settings.
                  </span>
                )}
              </div>
            )}

            {/* Emirates ID / Member ID / DHA Member ID */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                {idType === "EMIRATESID"
                  ? "Emirates ID"
                  : idType === "DHAMEMBERID"
                    ? "DHA Member ID"
                    : idType === "POLICYNUMBER"
                      ? "Policy Number"
                      : "Member ID"}
                <span className="text-red-600 ml-1">*</span>
              </label>
              <input
                type="text"
                value={emiratesId}
                onChange={handleEmiratesIdChange}
                placeholder={
                  idType === "EMIRATESID"
                    ? "Enter Emirates ID (e.g., 784-1234-1234567-1)"
                    : idType === "DHAMEMBERID"
                      ? "Enter DHA Member ID"
                      : idType === "POLICYNUMBER"
                        ? "Enter Policy Number"
                        : "Enter Member ID"
                }
                className={`w-full border ${errors.emiratesId || emiratesIdInputWarning ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
              />
              {emiratesIdInputWarning && (
                <span className="text-orange-600 text-sm mt-1 block">
                  {emiratesIdInputWarning}
                </span>
              )}
              {errors.emiratesId && !emiratesIdInputWarning && (
                <span className="text-red-500 text-sm mt-1 block">
                  {errors.emiratesId}
                </span>
              )}
              <small className="text-gray-500 mt-1 block">
                {idType === "EMIRATESID"
                  ? "Your Emirates ID is a 15-digit number."
                  : idType === "DHAMEMBERID"
                    ? "Enter your DHA Member ID number."
                    : idType === "POLICYNUMBER"
                      ? "Enter your Policy Number."
                      : ""}
              </small>
            </div>

            {/* Split Phone (ADNIC at Org1) */}
            {isOrg1Ins017 && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Mobile Number <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <Select
                    value={
                      phoneCode ? { value: phoneCode, label: phoneCode } : null
                    }
                    onChange={handlePhoneCodeChange}
                    options={[
                      { value: "50", label: "50" },
                      { value: "52", label: "52" },
                      { value: "54", label: "54" },
                      { value: "55", label: "55" },
                      { value: "56", label: "56" },
                      { value: "57", label: "57" },
                      { value: "58", label: "58" },
                    ]}
                    placeholder="Code"
                    styles={{
                      container: (base) => ({ ...base, minWidth: "120px" }),
                    }}
                  />
                  <input
                    type="text"
                    value={phoneSuffix}
                    onChange={handlePhoneSuffixChange}
                    placeholder="7 digit number"
                    maxLength={7}
                    className={`flex-1 border ${errors.phoneNumber ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                  />
                </div>
                {errors.phoneNumber && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.phoneNumber}
                  </span>
                )}
                <small className="text-gray-500 mt-1 block">
                  UAE mobile number format: 971-XX-XXXXXXX
                </small>
              </div>
            )}

            {/* Phone Number (eCare, Daman Thiqa, Daman, D004, Lifeline@AlNoor) */}
            {showPhoneField && !isOrg1Ins017 && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  placeholder="971XXXXXXXXX or 05XXXXXXXX"
                  maxLength={15}
                  className={`w-full border ${errors.phoneNumber ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.phoneNumber && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.phoneNumber}
                  </span>
                )}
                <small className="text-gray-500 mt-1 block">
                  UAE phone number (digits only)
                </small>
              </div>
            )}

            {/* Service Type (eCare, Lifeline@AlNoor) */}
            {showServiceTypeField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Service Type
                </label>
                <Select
                  value={
                    serviceType
                      ? { label: serviceType, value: serviceType }
                      : null
                  }
                  onChange={(selected) => setServiceType(selected?.value || "")}
                  options={[
                    { label: "Consultation GP", value: "Consultation GP" },
                    {
                      label: "Consultation Specialist",
                      value: "Consultation Specialist",
                    },
                  ]}
                  placeholder="Select service type"
                />
              </div>
            )}

            {/* AXA Dental Options */}
            {showDentalOptions && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Dental
                </label>
                <Select
                  value={[
                    { label: "Yes", value: "YES" },
                    { label: "No", value: "NO" },
                  ].find((opt) => opt.value === useDental)}
                  onChange={(selected) => setUseDental(selected?.value || "NO")}
                  options={[
                    { label: "Yes", value: "YES" },
                    { label: "No", value: "NO" },
                  ]}
                  placeholder="Should use Dental?"
                />
              </div>
            )}

            {/* Referral Code (Aafiya) */}
            {showReferralCodeField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Referral Code{" "}
                  <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={handleReferralCodeChange}
                  placeholder="Enter referral code"
                  maxLength={50}
                  className={`w-full border ${errors.referralCode ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.referralCode && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.referralCode}
                  </span>
                )}
              </div>
            )}

            {/* Referral Number (TPA002 - NextCare) */}
            {showReferralNoField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Referral Number{" "}
                  <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={referralNo}
                  onChange={handleReferralNoChange}
                  placeholder="Enter referral number"
                  maxLength={32}
                  className="w-full border border-gray-300 rounded-md p-3"
                />
                <small className="text-gray-500 mt-1 block">
                  Maximum 32 characters
                </small>
              </div>
            )}

            {/* Referring Physician - TPA001, TPA004, INS026, TPA023, D004 */}
            {showReferringPhysicianField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Referring Physician ID{" "}
                  {isReferringPhysicianRequired ? (
                    <span className="text-red-600">*</span>
                  ) : (
                    <span className="text-gray-400 text-xs">(optional)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={referringPhysician}
                  onChange={handleReferringPhysicianChange}
                  placeholder="Enter referring physician ID"
                  maxLength={100}
                  className={`w-full border ${errors.referringPhysician ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.referringPhysician && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.referringPhysician}
                  </span>
                )}
                <small className="text-gray-500 mt-1 block">
                  {isReferringPhysicianRequired
                    ? "Required for referral visits"
                    : "ID of the referring physician (if applicable)"}
                </small>
              </div>
            )}

            {/* Referral Document Upload - Only for TPA001 and TPA004 */}
            {["TPA001", "TPA004"].includes(options) && (
            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                Referral Document{" "}
                <span className="text-gray-400 text-xs">(optional)</span>
              </label>

              {/* Upload Area */}
              {!referralDocument && (
                <div className="relative">
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
                  <div className={`border-2 border-dashed ${referralDocumentError ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50"} rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors ${isReferralDocumentUploading ? "opacity-50" : ""}`}>
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
                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
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

            {/* POD Fields (Daman, Daman Thiqa, D004) */}
            {shouldShowPodFields && (
              <>
                {/* Maternity Flag */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-2">
                    Maternity?{" "}
                    <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <Select
                    value={
                      isMaternity
                        ? { value: "1", label: "True" }
                        : { value: "0", label: "False" }
                    }
                    onChange={(selected) =>
                      setIsMaternity(selected?.value === "1")
                    }
                    options={[
                      { value: "1", label: "True" },
                      { value: "0", label: "False" },
                    ]}
                    placeholder="Select True or False"
                    isSearchable={false}
                  />
                </div>

                {/* Not Related to Chief Complaint */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notRelatedToChiefComplaint}
                    onChange={(e) =>
                      setNotRelatedToChiefComplaint(e.target.checked)
                    }
                    className="w-5 h-5 cursor-pointer"
                  />
                  <label className="font-semibold text-gray-700 cursor-pointer">
                    Visit not related to same chief complaint
                  </label>
                </div>

                {/* Member Present at Facility (TPA001, TPA004) */}
                {["TPA001", "TPA004"].includes(options) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="memberPresentAtFacility"
                      checked={isMemberPresentAtFacility}
                      onChange={(e) => setIsMemberPresentAtFacility(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <label htmlFor="memberPresentAtFacility" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Member Present at Facility
                    </label>
                  </div>
                )}

                {/* POD Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-2">
                      POD?{" "}
                      <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <Select
                      value={
                        isPod
                          ? { value: "1", label: "Yes" }
                          : { value: "0", label: "No" }
                      }
                      onChange={(selected) => {
                        const isYes = selected?.value === "1";
                        setIsPod(isYes);
                        if (!isYes) setPodId("");
                      }}
                      options={[
                        { value: "1", label: "Yes" },
                        { value: "0", label: "No" },
                      ]}
                      placeholder="Select Yes or No"
                      isSearchable={false}
                    />
                  </div>

                  {isPod && (
                    <div>
                      <label className="block font-semibold text-gray-700 mb-2">
                        POD ID <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={podId}
                        onChange={handlePodIdChange}
                        placeholder="Enter POD ID"
                        maxLength={50}
                        className={`w-full border ${errors.pod ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                      />
                      {errors.pod && (
                        <span className="text-red-500 text-sm mt-1 block">
                          {errors.pod}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Payer Name (NextCare with Policy Number) */}
            {showPayerNameField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Payer Name <span className="text-red-600">*</span>
                </label>
                <Select
                  value={
                    payerName ? { value: payerName, label: payerName } : null
                  }
                  onChange={handlePayerNameChange}
                  options={Object.values(payerOptions).map((name) => ({
                    value: name,
                    label: name,
                  }))}
                  placeholder="Select a payer name"
                  isSearchable
                />
                {errors.payerName && (
                  <span className="text-red-500 text-sm mt-1 block">
                    {errors.payerName}
                  </span>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6 flex gap-3 mt-6 border-t border-gray-200">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isLoadingInsurance}
                className="flex-1 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {isLoadingInsurance ? (
                  "Loading patient data..."
                ) : isSubmitting ? (
                  <span className="flex flex-col items-center justify-center">
                    <span className="flex items-center">
                      <svg
                        className="animate-spin h-5 w-5 mr-2"
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
                      {statusMessage || "Checking..."}
                    </span>
                    {pollingAttempts > 0 && (
                      <span className="text-xs mt-1 opacity-70">
                        Attempt {pollingAttempts}/150 (max 5 min)
                      </span>
                    )}
                  </span>
                ) : (
                  "Check Eligibility"
                )}
              </Button>
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
