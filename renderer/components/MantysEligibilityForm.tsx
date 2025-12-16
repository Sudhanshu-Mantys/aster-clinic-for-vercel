import React, { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import { PatientData, InsuranceData } from "../lib/api";
import { Button } from "./ui/button";
import { cachedFetch, fetchWithTimeout } from "../lib/request-cache";
import {
  MantysEligibilityResponse,
  TPACode,
  IDType,
  VisitType,
} from "../types/mantys";
import {
  buildMantysPayload,
  checkMantysEligibility,
} from "../lib/mantys-utils";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { EligibilityHistoryService } from "../utils/eligibilityHistory";
import pollingService from "../services/eligibilityPollingService";
import { useAuth } from "../contexts/AuthContext";
import { EligibilityCheckMetadata } from "../lib/redis-eligibility-mapping";

interface MantysEligibilityFormProps {
  patientData: PatientData | null;
  insuranceData: InsuranceData | null;
  onClose?: () => void;
}

export const MantysEligibilityForm: React.FC<MantysEligibilityFormProps> = ({
  patientData,
  insuranceData,
  onClose,
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

  // Split phone for specific org (ADNIC at org1)
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSuffix, setPhoneSuffix] = useState("");

  // Maternity type
  const [maternityType, setMaternityType] = useState("");

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
  const monitoringIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Results State
  const [mantysResponse, setMantysResponse] =
    useState<MantysEligibilityResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Organization/Clinic Context
  const { user } = useAuth();
  const selectedOrganizationId: string = "aster-clinics"; // Example: "medcare", "al-noor", "healthhub", "kims", "org1"
  const selectedClinicId: string = user?.selected_team_id || "92d5da39-36af-4fa2-bde3-3828600d7871"; // Get from auth context

  // TPA Config and Doctors State
  const [tpaConfig, setTpaConfig] = useState<any>(null);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [isDoctorCompulsory, setIsDoctorCompulsory] = useState(false);
  const [isLoadingTPAConfig, setIsLoadingTPAConfig] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Previous Searches State
  const [previousSearches, setPreviousSearches] = useState<EligibilityCheckMetadata[]>([]);
  const [loadingPreviousSearches, setLoadingPreviousSearches] = useState(false);

  // ============================================================================
  // PRE-FILL FORM WITH PATIENT DATA
  // ============================================================================

  // Load TPA config and doctors when insurance data, options, or clinic ID changes
  useEffect(() => {
    if (selectedClinicId) {
      loadDoctors();
      // Try to load TPA config - prioritize payer_code, then options
      const identifier = insuranceData?.payer_code || (options && options !== "BOTH" ? options : null);
      if (identifier) {
        loadTPAConfig(identifier);
      }
    }
  }, [selectedClinicId, insuranceData?.payer_code, options]);

  const loadTPAConfig = async (identifier: string) => {
    if (!selectedClinicId || !identifier) return;
    // Skip if already loading
    if (isLoadingTPAConfig) return;

    setIsLoadingTPAConfig(true);
    try {
      console.log("🔍 Loading TPA config for identifier:", identifier, "clinic:", selectedClinicId);
      const response = await cachedFetch(`/api/clinic-config/tpa?clinic_id=${selectedClinicId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("📦 Received TPA configs:", data.configs?.length || 0, "configs");
        if (data.configs && Array.isArray(data.configs)) {
          // Log all config identifiers for debugging
          console.log("🔑 Available TPA config identifiers:", data.configs.map((c: any) => ({
            ins_code: c.ins_code,
            payer_code: c.payer_code,
            tpa_id: c.tpa_id,
            tpa_name: c.tpa_name
          })));

          // Try multiple ways to find the config:
          // 1. By ins_code (primary identifier)
          // 2. By payer_code
          // 3. By tpa_id
          let config = data.configs.find(
            (c: any) => c.ins_code === identifier
          );
          if (!config) {
            config = data.configs.find(
              (c: any) => c.payer_code === identifier
            );
          }
          if (!config) {
            config = data.configs.find(
              (c: any) => c.tpa_id === identifier
            );
          }

          if (config) {
            console.log("✅ Found TPA config:", {
              ins_code: config.ins_code,
              tpa_name: config.tpa_name,
              extra_form_fields: config.extra_form_fields
            });
            setTpaConfig(config);
            // Check if doctor is compulsory
            const extraFormFields = config.extra_form_fields || [];
            const doctorField = extraFormFields.find((field: any) => field.field === "doctor");
            const isCompulsory = doctorField?.required === true;
            console.log("👨‍⚕️ Doctor compulsory:", isCompulsory, "doctorField:", doctorField);
            setIsDoctorCompulsory(isCompulsory);
          } else {
            console.log("⚠️ No TPA config found for identifier:", identifier, "- Available configs:", data.configs.map((c: any) => c.ins_code || c.tpa_id));
            // Reset if not found
            setTpaConfig(null);
            setIsDoctorCompulsory(false);
          }
        }
      } else {
        console.error("❌ Failed to fetch TPA configs, status:", response.status);
      }
    } catch (error) {
      console.error("❌ Failed to load TPA config:", error);
    } finally {
      setIsLoadingTPAConfig(false);
    }
  };

  const loadDoctors = async () => {
    if (!selectedClinicId) return;
    // Skip if already loading or already loaded
    if (isLoadingDoctors || doctorsList.length > 0) return;

    setIsLoadingDoctors(true);
    try {
      const response = await cachedFetch(`/api/clinic-config/doctors?clinic_id=${selectedClinicId}`);
      if (response.ok) {
        const data = await response.json();
        setDoctorsList(data.configs || []);
      }
    } catch (error) {
      console.error("Failed to load doctors:", error);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  // Fetch appointment data to get physician information and pre-fill doctor
  useEffect(() => {
    const fetchAppointmentData = async () => {
      if (patientData?.appointment_id && selectedClinicId && doctorsList.length > 0) {
        try {
          // Get today's date for the API
          const today = new Date();
          const fromDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

          const response = await fetch(`/api/appointments/today?fromDate=${fromDate}&toDate=${fromDate}`);
          if (response.ok) {
            const data = await response.json();
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
              const contextResponse = await fetchWithTimeout(
                "/api/patient/context",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    appointmentId: patientData.appointment_id,
                    mpi: patientData.mpi,
                  }),
                },
                3000 // 3 second timeout
              );

              if (contextResponse.ok) {
                const context = await contextResponse.json();
                if (context.nationality_id && context.nationality_id.trim()) {
                  emiratesIdValue = context.nationality_id.trim();
                  console.log("✅ Using Emirates ID from appointment Redis (nationality_id):", emiratesIdValue);
                }
              }
            } catch (error) {
              console.warn("⚠️ Could not fetch appointment context from Redis:", error);
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
              const contextResponse = await fetchWithTimeout(
                "/api/patient/context",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    appointmentId: patientData.appointment_id,
                    mpi: patientData.mpi,
                  }),
                },
                3000 // 3 second timeout
              );

              if (contextResponse.ok) {
                const context = await contextResponse.json();
                if (context.nationality_id) {
                  emiratesIdValue = context.nationality_id;
                  console.log("✅ Using Emirates ID from appointment Redis (nationality_id):", emiratesIdValue);
                }
              }
            } catch (error) {
              console.warn("⚠️ Could not fetch appointment context from Redis:", error);
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
      // Neuron
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
      {
        label: "Maternity",
        value: "MATERNITY",
        extraArgs: {
          title: "maternity_type",
          titleLabel: "Maternity Type",
          options: [
            { label: "Normal Delivery", value: "normal_delivery" },
            { label: "C-Section", value: "c_section" },
            { label: "Prenatal", value: "prenatal" },
            { label: "Postnatal", value: "postnatal" },
          ],
        },
      },
    ],
    TPA002: [
      // NextCare
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Chronic Out", value: "CHRONIC_OUT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    TPA003: [
      // Al Madallah
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    TPA004: [
      // NAS
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
      {
        label: "Maternity",
        value: "MATERNITY",
        extraArgs: {
          title: "maternity_type",
          titleLabel: "Maternity Type",
          options: [
            { label: "Normal Delivery", value: "normal_delivery" },
            { label: "C-Section", value: "c_section" },
            { label: "Prenatal", value: "prenatal" },
            { label: "Postnatal", value: "postnatal" },
          ],
        },
      },
    ],
    TPA010: [
      // FMC
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    TPA023: [
      // Daman Thiqa
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    TPA026: [
      // Aafiya
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    TPA029: [
      // eCare
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    INS010: [
      // AXA
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Dental", value: "DENTAL" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    INS017: [
      // ADNIC
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    INS026: [
      // Daman
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
    ],
    D004: [
      // Daman Variant
      { label: "Outpatient", value: "OUTPATIENT" },
      { label: "Emergency", value: "EMERGENCY" },
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
      options === "INS026" || // Daman
      options === "TPA029" || // eCare
      options === "D004" || // Daman variant
      options === "TPA023" || // Daman Thiqa
      options === "BOTH" ||
      options === "DHPO" ||
      options === "RIYATI" ||
      (options === "TPA037" && selectedOrganizationId === "al-noor") || // Lifeline at Al Noor
      (options === "TPA001" && selectedOrganizationId === "org1") || // Neuron at Org1
      (options === "INS017" && selectedOrganizationId === "org1") || // ADNIC at Org1
      (options === "TPA004" && selectedOrganizationId === "org1") // NAS at Org1
    );
  }, [isDoctorCompulsory, options, selectedOrganizationId]);

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

  // Visit category (ADNIC at Org1)
  const showVisitCategoryField = isOrg1Ins017;

  const visitCategoryOptions = [
    { label: "FIRST VISIT", value: "FIRST_VISIT" },
    { label: "VISIT WITHOUT REFERRAL", value: "VISIT_WITHOUT_REFERRAL" },
  ];

  // Maternity extra args (NAS, Neuron)
  const showMaternityExtraArgs =
    visitType === "MATERNITY" && (options === "TPA004" || options === "TPA001");

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
      let searches: EligibilityCheckMetadata[] = [];

      // Try by patientId first
      if (patientId) {
        const response = await fetch(`/api/eligibility/get-by-patient-id?patientId=${patientId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            searches = data.data;
          }
        }
      }

      // If no results and we have mpi, try by mpi
      if (searches.length === 0 && mpi) {
        const response = await fetch(`/api/eligibility/get-by-mpi?mpi=${mpi}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            searches = data.data;
          }
        }
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
    const rawValue = e.target.value.trim();
    const digits = rawValue.replace(/\D/g, "");
    const containsLetters = /[a-zA-Z]/.test(rawValue);

    // Clear warnings
    setEmiratesIdInputWarning(null);

    // ========== EMIRATES ID HANDLING ==========
    if (idType === "EMIRATESID") {
      // If letters detected, show warning
      if (containsLetters) {
        setEmiratesIdInputWarning(
          "Emirates ID contains numbers and dashes only. Please switch to Member ID if needed.",
        );
        // Format only the digits found
        let formattedId = digits;
        if (digits.length > 3) {
          formattedId = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        }
        if (digits.length > 7) {
          formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
        }
        setEmiratesId(formattedId.slice(0, 18));
        return;
      }

      // If too many digits
      if (digits.length > 15) {
        setEmiratesIdInputWarning("Emirates ID has only 15 digits.");
        const limitedDigits = digits.slice(0, 15);
        const formattedId = `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 7)}-${limitedDigits.slice(7, 14)}-${limitedDigits.slice(14, 15)}`;
        setEmiratesId(formattedId.slice(0, 18));
        return;
      }

      // Format progressively: XXX-XXXX-XXXXXXX-X
      let formattedId = digits;
      if (digits.length > 3) {
        formattedId = `${digits.slice(0, 3)}-${digits.slice(3)}`;
      }
      if (digits.length > 7) {
        formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
      if (digits.length > 14) {
        formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14, 15)}`;
      }
      setEmiratesId(formattedId.slice(0, 18));
    }
    // ========== DHA MEMBER ID HANDLING ==========
    else if (idType === "DHAMEMBERID") {
      // DHA Member ID format: XXXX-XXX-XXXXXXXXX-XX (alphanumeric)
      const alphanumericOnly = rawValue
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();

      let formattedDhaId = "";

      if (alphanumericOnly.length > 0) {
        formattedDhaId += alphanumericOnly.substring(
          0,
          Math.min(4, alphanumericOnly.length),
        );
      }
      if (alphanumericOnly.length > 4) {
        formattedDhaId +=
          "-" +
          alphanumericOnly.substring(4, Math.min(7, alphanumericOnly.length));
      }
      if (alphanumericOnly.length > 7) {
        formattedDhaId +=
          "-" +
          alphanumericOnly.substring(7, Math.min(16, alphanumericOnly.length));
      }
      if (alphanumericOnly.length > 16) {
        formattedDhaId +=
          "-" +
          alphanumericOnly.substring(16, Math.min(18, alphanumericOnly.length));
      }

      setEmiratesId(formattedDhaId.slice(0, 21)); // Max 21 chars with dashes

      // Validation warning
      const dhaMemberIdRegex =
        /^[A-Za-z0-9]{4}-[A-Za-z0-9]{3}-[A-Za-z0-9]{9}-[A-Za-z0-9]{2}$/;
      if (
        formattedDhaId.length > 0 &&
        alphanumericOnly.length <= 18 &&
        !dhaMemberIdRegex.test(formattedDhaId)
      ) {
        setEmiratesIdInputWarning(
          "Please ensure the DHA Member ID is in the format XXXX-XXX-XXXXXXXXX-XX.",
        );
      }
    }
    // ========== OTHER ID TYPES (Member ID, Policy Number, etc.) ==========
    else {
      setEmiratesId(rawValue);
    }
  };

  // Split phone number handler (for ADNIC Org1)
  const setPhoneNumberParts = (code: string, suffix: string) => {
    setPhoneCode(code);
    setPhoneSuffix(suffix);
    setPhoneNumber(`971-${code}-${suffix}`);
  };

  // ============================================================================
  // FORM VALIDATION
  // ============================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Emirates ID / Member ID validation
    if (!emiratesId) {
      newErrors.emiratesId = "This field is required";
    } else if (idType === "EMIRATESID") {
      const emiratesIdRegex = /^\d{3}-\d{4}-\d{7}-\d{1}$/;
      if (!emiratesIdRegex.test(emiratesId)) {
        newErrors.emiratesId =
          "Invalid Emirates ID format (must be XXX-XXXX-XXXXXXX-X)";
      }
    }

    // Visit type validation
    if (!visitType) {
      newErrors.visitType = "Visit type is required";
    }

    // Doctor name validation
    if (showDoctorsNameField && !doctorName) {
      newErrors.doctorName = "Doctor name is required";
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

    // Name validation
    if (showNameField && !name) {
      newErrors.name = "Name is required";
    }

    // Phone validation
    if (showPhoneField && !phoneNumber) {
      newErrors.phoneNumber = "Phone number is required";
    }

    if (
      isOrg1Ins017 &&
      (!phoneCode || !phoneSuffix || phoneSuffix.length !== 7)
    ) {
      newErrors.phoneNumber =
        "Please enter a valid mobile number (code + 7 digits)";
    }

    // POD validation
    if (shouldShowPodFields && isPod && !podId) {
      newErrors.pod = "POD ID is required when POD is Yes";
    }

    // Payer name validation (NextCare Policy Number)
    if (showPayerNameField && !payerName) {
      newErrors.payerName = "Payer name is required";
    }

    // Visit category validation (ADNIC Org1)
    if (showVisitCategoryField && !visitCategory) {
      newErrors.visitCategory = "Visit category is required";
    }

    // Maternity extra args validation
    if (showMaternityExtraArgs && !maternityType) {
      newErrors.maternityType = "Maternity type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  // Cleanup monitoring interval on unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  // Monitor status updates from background polling service
  // The actual polling happens in the background service
  const monitorTaskStatus = (taskId: string, historyId: string) => {
    setStatusMessage("Task created, monitoring status...");
    setCurrentStatus("pending");

    // Clear any existing interval
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }

    // Check status periodically to update UI
    monitoringIntervalRef.current = setInterval(async () => {
      const historyItem = await EligibilityHistoryService.getById(historyId);

      if (!historyItem) {
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
          monitoringIntervalRef.current = null;
        }
        return;
      }

      // Update UI based on history item status
      setPollingAttempts(historyItem.pollingAttempts || 0);

      if (historyItem.status === "pending") {
        setStatusMessage("Navigating Insurance Portal...");
        setCurrentStatus("pending");
      } else if (historyItem.status === "processing") {
        setStatusMessage("Extracting eligibility data from TPA portal...");
        setCurrentStatus("processing");

        // Update interim results in UI
        if (historyItem.interimResults) {
          if (historyItem.interimResults.screenshot) {
            setInterimScreenshot(historyItem.interimResults.screenshot);
          }
          if (historyItem.interimResults.documents) {
            setInterimDocuments(
              historyItem.interimResults.documents.map((doc) => ({
                id: doc.name,
                tag: doc.type,
                url: doc.url,
              })),
            );
          }
        }
      } else if (historyItem.status === "complete") {
        setStatusMessage("Eligibility check complete!");
        setCurrentStatus("complete");
        setMantysResponse(historyItem.result);
        setShowResults(true);
        setIsMinimized(false); // Reopen modal when complete to show results
        // Keep isSubmitting true so modal stays open to show completion status
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
          monitoringIntervalRef.current = null;
        }
      } else if (historyItem.status === "error") {
        setApiError(historyItem.error || "Eligibility check failed");
        setIsMinimized(false); // Reopen modal when error occurs
        // Keep isSubmitting true so modal stays open to show error
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
          monitoringIntervalRef.current = null;
        }
      }
    }, 2000); // Check every 2 seconds for UI updates (reduced from 500ms to reduce API load)
  };

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
          const contextResponse = await fetchWithTimeout(
            "/api/patient/context",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                appointmentId: patientData.appointment_id,
                mpi: patientData.mpi,
              }),
            },
            3000 // 3 second timeout
          );

          if (contextResponse.ok) {
            const context = await contextResponse.json();
            enrichedPatientData = {
              ...patientData,
              patient_id: context.patientId,
              appointment_id: context.appointmentId,
              encounter_id: context.encounterId,
            };
            setEnrichedPatientContext(enrichedPatientData);
            console.log("✅ Enriched patient data from Redis:", enrichedPatientData);
          }
        } catch (redisError) {
          console.warn("⚠️ Could not fetch patient context from Redis:", redisError);
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

      // Build Mantys payload according to API specification
      const mantysPayload = buildMantysPayload({
        idValue: emiratesId,
        tpaId: options as TPACode,
        idType: idType as IDType,
        visitType: visitType as VisitType,
        doctorName: doctorDhaId || doctorName || undefined,
        payerName: undefined,
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
      const response = await fetch("/api/mantys/eligibility-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithMetadata),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      const data = await response.json();
      const createdTaskId = data.task_id;

      if (!createdTaskId) {
        throw new Error("No task ID received from server");
      }

      console.log("Task created with ID:", createdTaskId);
      setTaskId(createdTaskId);
      setStatusMessage("Task created, checking status...");

      // Add to history (use enriched data if available)
      // Store the actual numeric patient ID if available
      const actualPatientId = enrichedPatientData?.patient_id?.toString();

      const historyItem = await EligibilityHistoryService.add({
        patientId: actualPatientId || emiratesId, // Use patient ID if available, fall back to Emirates ID
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

      // Step 2: Add to background polling service
      // This will continue polling even if user closes the tab
      await pollingService.addTask(createdTaskId, historyItem.id);

      // Step 3: Monitor status for UI updates (optional - user can close modal)
      monitorTaskStatus(createdTaskId, historyItem.id);

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
    // Reset extraction states
    setInterimScreenshot(null);
    setInterimDocuments([]);
    setCurrentStatus("idle");
    setCurrentHistoryId(null);
    setStatusMessage("");
    setPollingAttempts(0);
    setTaskId(null);

    // Clear monitoring interval if exists
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // If results are available, show the results display
  if (showResults && mantysResponse) {
    // Use enriched context if available, otherwise use original patientData
    const contextToUse = enrichedPatientContext || patientData;

    return (
      <MantysResultsDisplay
        response={mantysResponse}
        onClose={onClose}
        onCheckAnother={handleCheckAnother}
        patientMPI={contextToUse?.mpi}
        patientId={contextToUse?.patient_id}
        appointmentId={contextToUse?.appointment_id}
        encounterId={contextToUse?.encounter_id}
      />
    );
  }

  return (
    <>
      {/* Extraction Progress Modal */}
      <ExtractionProgressModal
        isOpen={isSubmitting && !isMinimized}
        onClose={() => {
          if (currentStatus === "complete") {
            setIsSubmitting(false);
            setIsMinimized(false);
          }
        }}
        onMinimize={() => {
          setIsMinimized(true);
        }}
        status={currentStatus}
        statusMessage={statusMessage}
        interimScreenshot={interimScreenshot}
        interimDocuments={interimDocuments}
        pollingAttempts={pollingAttempts}
        maxAttempts={150}
        viewMode="live"
      />

      <div className="space-y-6">
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
                  onChange={(selected) => setVisitType(selected?.value || "")}
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
                  <span className="text-red-500 text-sm mt-1">
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
                  onChange={(selected) =>
                    setVisitCategory(selected?.value || "")
                  }
                  options={visitCategoryOptions}
                  placeholder="Select visit category"
                />
                {errors.visitCategory && (
                  <span className="text-red-500 text-sm mt-1">
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
                  onChange={(selected) =>
                    setMaternityType(selected?.value || "")
                  }
                  options={maternityExtraArgs.options}
                  placeholder="Select maternity type"
                  isSearchable
                />
                {errors.maternityType && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.maternityType}
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter patient's name"
                  className={`w-full border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.name && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.name}
                  </span>
                )}
              </div>
            )}

            {/* Doctor Name */}
            {showDoctorsNameField && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Doctor's Name <span className="text-red-600">*</span>
                </label>
                <Select
                  value={DOCTORS_LIST.find((opt) => opt.value === doctorName)}
                  onChange={(selected) => setDoctorName(selected?.value || "")}
                  options={DOCTORS_LIST}
                  placeholder="Select doctor's name"
                  isSearchable
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
                  <span className="text-red-500 text-sm mt-1">
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
                    onChange={(selected) =>
                      setPhoneNumberParts(selected?.value || "", phoneSuffix)
                    }
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
                    onChange={(e) =>
                      setPhoneNumberParts(phoneCode, e.target.value)
                    }
                    placeholder="7 digit number"
                    maxLength={7}
                    className="flex-1 border border-gray-300 rounded-md p-3"
                  />
                </div>
                {errors.phoneNumber && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.phoneNumber}
                  </span>
                )}
              </div>
            )}

            {/* Phone Number (eCare, Daman Thiqa, Daman, D004, Lifeline@AlNoor) */}
            {showPhoneField && !isOrg1Ins017 && (
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setPhoneNumber(digits);
                  }}
                  placeholder="Enter patient's phone number"
                  maxLength={15}
                  className={`w-full border ${errors.phoneNumber ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                />
                {errors.phoneNumber && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.phoneNumber}
                  </span>
                )}
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
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referral code"
                  className="w-full border border-gray-300 rounded-md p-3"
                />
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
                        onChange={(e) => setPodId(e.target.value)}
                        placeholder="Enter POD ID"
                        className={`w-full border ${errors.pod ? "border-red-500" : "border-gray-300"} rounded-md p-3`}
                      />
                      {errors.pod && (
                        <span className="text-red-500 text-sm mt-1">
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
                  onChange={(selected) => setPayerName(selected?.value || null)}
                  options={Object.values(payerOptions).map((name) => ({
                    value: name,
                    label: name,
                  }))}
                  placeholder="Select a payer name"
                  isSearchable
                />
                {errors.payerName && (
                  <span className="text-red-500 text-sm mt-1">
                    {errors.payerName}
                  </span>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6 flex gap-3 mt-6 border-t border-gray-200">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {isSubmitting ? (
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
                  "✓ Check Eligibility"
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
