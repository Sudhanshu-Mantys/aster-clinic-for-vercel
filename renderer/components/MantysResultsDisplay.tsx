/**
 * Mantys Results Display Component - Simplified Modern UI
 * Uses tabbed interface with collapsible sections
 */

import React, { useEffect, useState } from "react";
import Select from "react-select";
import { MantysEligibilityResponse, MantysKeyFields } from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Sidebar } from "./ui/sidebar";
import { LifetrenzEligibilityPreview } from "./LifetrenzEligibilityPreview";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "./ui/modal";
import { StatusDialog } from "./StatusDialog";
import { asterApi, patientApi } from "../lib/api-client";
import { useMantysActions } from "../hooks/useMantysActions";
import {
  CheckCircle2,
  XCircle,
  FileText,
  User,
  CreditCard,
  Hospital,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
} from "lucide-react";

interface MantysResultsDisplayProps {
  response: MantysEligibilityResponse;
  onClose?: () => void;
  onCheckAnother?: () => void;
  screenshot?: string | null;
  patientMPI?: string;
  patientId?: number;
  appointmentId?: number;
  encounterId?: number;
  physicianId?: number;
}

type TabValue = "overview" | "benefits" | "policy" | "documents";

export const MantysResultsDisplay: React.FC<MantysResultsDisplayProps> = ({
  response,
  onClose,
  onCheckAnother,
  screenshot,
  patientMPI,
  patientId,
  appointmentId,
  encounterId,
  physicianId,
}) => {
  const [activeTab, setActiveTab] = useState<TabValue>("documents");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [v3Result, setV3Result] = useState<unknown | null>(null);
  const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(true);

  // Save Policy Form States
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showSavePolicyModal, setShowSavePolicyModal] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // Form field states
  const [memberId, setMemberId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [selectedPayer, setSelectedPayer] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [lastRenewalDate, setLastRenewalDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [rateCard, setRateCard] = useState<string>("");

  // Patient Payable states
  const [hasDeductible, setHasDeductible] = useState<boolean>(false);
  const [deductibleFlat, setDeductibleFlat] = useState<string>("");
  const [deductibleMax, setDeductibleMax] = useState<string>("");
  const [hasCopay, setHasCopay] = useState<boolean>(false);
  const [chargeGroups, setChargeGroups] = useState<
    Array<{
      name: string;
      flat: string;
      percent: string;
      max: string;
    }>
  >([]);

  // Config data from API
  const [tpaConfig, setTpaConfig] = useState<any>(null);
  const [plansConfig, setPlansConfig] = useState<any[]>([]);
  const [networksConfig, setNetworksConfig] = useState<any[]>([]);
  const [planMappings, setPlanMappings] = useState<any[]>([]);
  const [payersConfig, setPayersConfig] = useState<any[]>([]);

  // Existing policies from Aster
  const [existingPolicies, setExistingPolicies] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [selectedExistingPolicy, setSelectedExistingPolicy] = useState<
    any | null
  >(null);
  const [isNewPolicy, setIsNewPolicy] = useState(false);

  const { user } = useAuth();

  const {
    handleUploadScreenshots,
    uploadingFiles,
    dialogOpen,
    dialogStatus,
    dialogTitle,
    dialogMessage,
    dialogReqId,
    dialogDocumentCount,
    dialogFailedCount,
    dialogErrorDetails,
    closeDialog,
  } = useMantysActions({
    clinicId: user?.selected_team_id,
    response,
    patientMPI,
    patientId,
    appointmentId,
    encounterId,
    physicianId,
  });

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;
  const screenshotSrc = screenshot || data?.screenshot_key || null;

  useEffect(() => {
    setShowScreenshot(true);
  }, [screenshotSrc]);

  useEffect(() => {
    const isFinalStatus = ["found", "not_found", "error"].includes(
      response.status,
    );
    if (!isFinalStatus) {
      setV3Result(null);
      return;
    }

    const taskId = response.task_id;
    if (!taskId) return;

    let isMounted = true;
    const fetchV3Result = async () => {
      try {
        const resultResponse = await fetch(
          `/api/mantys/eligibility-result-v3?task_id=${encodeURIComponent(taskId)}`,
        );
        if (!resultResponse.ok) {
          throw new Error(
            `Failed to fetch v3 result: ${resultResponse.status}`,
          );
        }
        const resultData = await resultResponse.json();
        if (isMounted) {
          setV3Result(resultData);
        }
      } catch (error) {
        console.error("Failed to fetch v3 eligibility result:", error);
      }
    };

    fetchV3Result();
    return () => {
      isMounted = false;
    };
  }, [response.status, response.task_id]);

  // Load TPA Configuration and related configs
  useEffect(() => {
    const loadTPAConfig = async () => {
      const selectedClinicId = user?.selected_team_id;
      if (!selectedClinicId || !response.tpa) return;

      try {
        // Fetch TPA config
        const configResponse = await fetch(
          `/api/clinic-config/tpa?clinic_id=${selectedClinicId}`,
        );
        const configData = await configResponse.json();

        // Find config by ins_code, tpa_id, or payer_code
        let config = configData.configs.find(
          (c: any) => c.ins_code === response.tpa,
        );
        if (!config) {
          config = configData.configs.find(
            (c: any) => c.tpa_id === response.tpa,
          );
        }
        if (!config) {
          config = configData.configs.find(
            (c: any) => c.payer_code === response.tpa,
          );
        }

        if (config) {
          setTpaConfig(config);

          // Load related configs
          const tpaInsCode = config.ins_code || response.tpa;

          // Load plans
          const plansResponse = await fetch(
            `/api/clinic-config/plans?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`,
          );
          const plansData = await plansResponse.json();
          setPlansConfig(plansData.plans || []);

          // Load networks
          const networksResponse = await fetch(
            `/api/clinic-config/mantys-networks?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`,
          );
          const networksData = await networksResponse.json();
          setNetworksConfig(networksData.networks || []);

          // Load plan mappings
          const mappingsResponse = await fetch(
            `/api/clinic-config/plan-mappings?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`,
          );
          const mappingsData = await mappingsResponse.json();
          setPlanMappings(mappingsData.mappings || []);

          // Load payers
          const payersResponse = await fetch(
            `/api/clinic-config/payers?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`,
          );
          const payersData = await payersResponse.json();
          setPayersConfig(payersData.payers || []);
        }
      } catch (error) {
        console.error("Failed to load TPA configuration:", error);
      }
    };

    loadTPAConfig();
  }, [user?.selected_team_id, response.tpa]);

  // Auto-select plan from network mapping
  useEffect(() => {
    if (
      !selectedNetwork ||
      planMappings.length === 0 ||
      plansConfig.length === 0
    )
      return;

    // Find mappings for the selected network
    const networkMappings = planMappings.filter(
      (m: any) => m.mantys_network_name === selectedNetwork,
    );

    if (networkMappings.length > 0) {
      const defaultMapping = networkMappings.find((m: any) => m.is_default);
      const mappingToUse = defaultMapping || networkMappings[0];

      // Find the plan from config
      const mappedPlan = plansConfig.find(
        (p: any) => p.plan_id === mappingToUse.lt_plan_id,
      );

      if (mappedPlan) {
        setSelectedPlan(mappedPlan);
      }
    }
  }, [selectedNetwork, planMappings, plansConfig]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );
  };

  const handleSavePolicy = async () => {
    // Fetch existing policies first
    if (patientId) {
      setLoadingPolicies(true);
      try {
        const insuranceResponse = await patientApi.getInsuranceDetails({
          patientId: patientId,
          apntId: appointmentId || null,
          encounterId: encounterId || 0,
          customerId: 1,
          primaryInsPolicyId: null,
          siteId: 31,
          isDiscard: 0,
          hasTopUpCard: 0,
        });

        const policies = insuranceResponse.body?.Data || [];
        setExistingPolicies(policies);

        // Find active policy and pre-select it
        const activePolicy = policies.find(
          (p: any) => p.is_current === 1 || p.insurance_status === "active",
        );
        if (activePolicy) {
          setSelectedExistingPolicy(activePolicy);
          setIsNewPolicy(false);
        } else {
          setIsNewPolicy(true);
        }
      } catch (error) {
        console.error("Failed to fetch existing policies:", error);
        setExistingPolicies([]);
        setIsNewPolicy(true);
      } finally {
        setLoadingPolicies(false);
      }
    }

    // Initialize form fields from Mantys response
    setMemberId(
      data.patient_info?.patient_id_info?.member_id ||
        data.patient_info?.policy_primary_member_id ||
        "",
    );

    setReceiverId(tpaConfig?.tpa_name || response.tpa || "");

    // Auto-select network
    if (
      data.policy_network?.all_networks &&
      data.policy_network.all_networks.length > 0
    ) {
      const firstNetwork = data.policy_network.all_networks[0];
      setSelectedNetwork(
        firstNetwork.network_value || firstNetwork.network || null,
      );
    }

    // Auto-match plan by name
    const planNameFromMantys = data.patient_info?.plan_name;
    if (planNameFromMantys && plansConfig.length > 0) {
      const matchingPlan = plansConfig.find((plan: any) => {
        const planName = plan.insurance_plan_name?.toLowerCase() || "";
        const mantysPlanName = planNameFromMantys.toLowerCase();
        return planName === mantysPlanName || planName.includes(mantysPlanName);
      });
      if (matchingPlan) {
        setSelectedPlan(matchingPlan);
        setRateCard(matchingPlan.plan_code || "");
      }
    }

    // Parse and set dates
    const parseDateToISO = (dateValue: any): string => {
      if (
        typeof dateValue === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ) {
        return dateValue;
      }
      if (
        typeof dateValue === "object" &&
        dateValue.DD &&
        dateValue.MM &&
        dateValue.YYYY
      ) {
        return `${dateValue.YYYY}-${String(dateValue.MM).padStart(2, "0")}-${String(dateValue.DD).padStart(2, "0")}`;
      }
      return "";
    };

    // Set start date
    const startDateValue =
      data.policy_start_date || data.policy_network?.start_date;
    setStartDate(parseDateToISO(startDateValue));

    // Set expiry date
    const expiryDateValue =
      data.policy_end_date || data.policy_network?.valid_upto;
    setExpiryDate(parseDateToISO(expiryDateValue));

    // Auto-populate copay details from Mantys response
    const copayDetails = data.copay_details_to_fill?.[0];
    if (copayDetails?.values_to_fill) {
      const chargeGroupsData: Array<{
        name: string;
        flat: string;
        percent: string;
        max: string;
      }> = [];
      const values = copayDetails.values_to_fill;

      if (values.LAB) {
        chargeGroupsData.push({
          name: "Laboratory",
          flat: values.LAB.copay || "0",
          percent: "0",
          max: values.LAB._maxDeductible || values.LAB.deductible || "0",
        });
      }
      if (values.MEDICINES) {
        chargeGroupsData.push({
          name: "Medicine",
          flat: values.MEDICINES.copay || "0",
          percent: "0",
          max:
            values.MEDICINES._maxDeductible ||
            values.MEDICINES.deductible ||
            "0",
        });
      }
      if (values.RADIOLOGY) {
        chargeGroupsData.push({
          name: "Radiology",
          flat: values.RADIOLOGY.copay || "0",
          percent: "0",
          max:
            values.RADIOLOGY._maxDeductible ||
            values.RADIOLOGY.deductible ||
            "0",
        });
      }
      if (values.CONSULTATION) {
        chargeGroupsData.push({
          name: "Consultation",
          flat: values.CONSULTATION.copay || "0",
          percent: "0",
          max:
            values.CONSULTATION._maxDeductible ||
            values.CONSULTATION.deductible ||
            "0",
        });
      }
      if (values.PROCEDURE) {
        chargeGroupsData.push({
          name: "Procedure",
          flat: values.PROCEDURE.copay || "0",
          percent: "0",
          max:
            values.PROCEDURE._maxDeductible ||
            values.PROCEDURE.deductible ||
            "0",
        });
      }
      if (values["DENTAL CONSULTATION & PROCEDURE"]) {
        chargeGroupsData.push({
          name: "Dental",
          flat: values["DENTAL CONSULTATION & PROCEDURE"].copay || "0",
          percent: "0",
          max:
            values["DENTAL CONSULTATION & PROCEDURE"]._maxDeductible ||
            values["DENTAL CONSULTATION & PROCEDURE"].deductible ||
            "0",
        });
      }

      setChargeGroups(chargeGroupsData);
      setHasDeductible(chargeGroupsData.some((cg) => parseFloat(cg.max) > 0));
      setHasCopay(chargeGroupsData.some((cg) => parseFloat(cg.flat) > 0));
    }

    // Auto-match payer
    const ensurePayersConfigLoaded = async () => {
      if (payersConfig.length > 0) return payersConfig;

      const selectedClinicId = user?.selected_team_id;
      if (!selectedClinicId || !tpaConfig) return [];

      const tpaInsCode = tpaConfig.ins_code || response.tpa;
      const payersResponse = await fetch(
        `/api/clinic-config/payers?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`,
      );
      const payersData = await payersResponse.json();
      const payers = payersData.payers || [];
      setPayersConfig(payers);
      return payers;
    };

    const currentPayersConfig = await ensurePayersConfigLoaded();

    // Extract payer code from response
    let payerCodeToMatch: string | null = null;

    console.log("=== DEBUG PAYER MATCHING ===");
    console.log("data.payer_id:", data.payer_id);
    console.log(
      "data.policy_network?.payer_name:",
      data.policy_network?.payer_name,
    );
    console.log("keyFields.payerName:", keyFields.payerName);

    // Priority: policy_network.payer_name > keyFields.payerName > payer_id
    // (payer_name contains the actual insurance company code like INS008,
    //  while payer_id might contain the TPA receiver code like TPA002)

    // First, try to extract from policy_network.payer_name (most reliable)
    if (data.policy_network?.payer_name) {
      const codeMatch = data.policy_network.payer_name.match(
        /\b(INS|TPA|D|DHPO|RIYATI|SP|A)\d+[A-Z]?\b/i,
      );
      if (codeMatch) {
        payerCodeToMatch = codeMatch[0].toUpperCase();
        console.log(
          "✓ Matched from policy_network.payer_name:",
          payerCodeToMatch,
        );
      }
    }

    // Fallback to keyFields.payerName
    if (!payerCodeToMatch && keyFields.payerName) {
      const codeMatch = keyFields.payerName.match(
        /\b(INS|TPA|D|DHPO|RIYATI|SP|A)\d+[A-Z]?\b/i,
      );
      if (codeMatch) {
        payerCodeToMatch = codeMatch[0].toUpperCase();
        console.log("✓ Matched from keyFields.payerName:", payerCodeToMatch);
      }
    }

    // Last resort: try payer_id if it's in the right format
    if (
      !payerCodeToMatch &&
      data.payer_id &&
      /^(INS|TPA|D|DHPO|RIYATI|SP|A)\d+[A-Z]?$/i.test(
        String(data.payer_id).toUpperCase(),
      )
    ) {
      payerCodeToMatch = String(data.payer_id).toUpperCase();
      console.log("✓ Matched from data.payer_id:", payerCodeToMatch);
    }

    console.log("Final payerCodeToMatch:", payerCodeToMatch);

    // Match payer by code
    console.log("Available payers count:", currentPayersConfig.length);
    console.log("Sample payer structure:", currentPayersConfig[0]);

    if (payerCodeToMatch) {
      const matchingPayer = currentPayersConfig.find((p: any) => {
        const payerCode = String(p.ins_tpa_code || "")
          .trim()
          .toUpperCase();
        console.log("Comparing:", payerCode, "with", payerCodeToMatch);
        return payerCode === payerCodeToMatch!.trim().toUpperCase();
      });
      if (matchingPayer) {
        console.log("✅ Found matching payer:", matchingPayer);
        setSelectedPayer(matchingPayer);
      } else {
        console.log("❌ No matching payer found for code:", payerCodeToMatch);
      }
    } else {
      console.log("❌ No payer code to match");
    }

    // Use setTimeout to ensure all state updates are processed before opening modal
    setTimeout(() => {
      setShowSavePolicyModal(true);
    }, 0);
  };

  const handleConfirmSavePolicy = async () => {
    const finalPatientId = patientId;
    const finalAppointmentId = appointmentId;
    const finalEncounterId = encounterId;

    if (!finalPatientId || !finalAppointmentId) {
      alert(
        "Missing required patient information (Patient ID or Appointment ID).",
      );
      return;
    }

    setSavingPolicy(true);
    setShowSavePolicyModal(false);

    try {
      // Get config values with fallbacks
      const siteId = tpaConfig?.lt_site_id
        ? parseInt(tpaConfig.lt_site_id, 10)
        : 31;
      const customerId = tpaConfig?.lt_customer_id
        ? parseInt(tpaConfig.lt_customer_id, 10)
        : 1;
      const createdBy = user?.id ? parseInt(user.id, 10) : 13295;
      const ltOtherConfig = tpaConfig?.lt_other_config || {};

      // Get insurance mapping ID from config or Mantys response
      const insuranceMappingId = tpaConfig?.hospital_insurance_mapping_id
        ? tpaConfig.hospital_insurance_mapping_id
        : data.patient_info?.insurance_mapping_id
          ? parseInt(data.patient_info.insurance_mapping_id, 10)
          : null;

      // Get plan code and plan ID from selected plan
      let planCodeFromConfig: string | null = null;
      let planIdFromConfig: number | null = null;
      if (selectedPlan) {
        planCodeFromConfig = selectedPlan.plan_code || null;
        planIdFromConfig = selectedPlan.plan_id || null;
      }

      // Get network ID from selected plan
      // In the Aster system, the plan_id IS the network_id
      // For example: plan_id 30530 corresponds to "N5 - MEDNET / DUBAICARE" network
      let networkIdNumeric: number | null = null;

      if (selectedPlan && selectedPlan.plan_id) {
        networkIdNumeric = parseInt(selectedPlan.plan_id, 10);
      }

      // Build insRules array from charge groups and deductible
      const insRules: any[] = [];

      // Charge group ID mapping (from Aster system)
      const chargeGroupIdMap: Record<string, number> = {
        Laboratory: 331,
        Medicine: 326,
        Radiology: 330,
        Consultation: 325,
        Procedure: 327,
        Dental: 329,
      };

      // Add deductible rule if exists
      if (hasDeductible && deductibleFlat) {
        insRules.push({
          isActive: 1,
          payableAmnt: parseFloat(deductibleFlat) || 0,
          patientInsTpaId: isNewPolicy
            ? 0
            : selectedExistingPolicy?.patient_insurance_tpa_policy_id || 0,
          copayDeductId: 0, // Will be auto-generated by API
          payableAmntType: 3, // Type 3 = flat deductible
          chargeGrpName: "",
          isAcrossChargeGroup: 0,
          chargeGrpId: null,
          specialityId: 0,
          payableAmountMax: deductibleMax
            ? parseFloat(deductibleMax).toFixed(2)
            : null,
          isDefault: 1,
          isDeductable: 1,
          isMaternity: 0,
        });
      }

      // Add copay rules for each charge group
      if (hasCopay && chargeGroups.length > 0) {
        chargeGroups.forEach((cg) => {
          const payableAmnt =
            parseFloat(cg.percent) || parseFloat(cg.flat) || 0;
          const payableAmntType = parseFloat(cg.percent) > 0 ? 2 : 1; // 2 = percentage, 1 = flat

          if (payableAmnt > 0) {
            insRules.push({
              isActive: 1,
              payableAmnt: payableAmnt,
              patientInsTpaId: isNewPolicy
                ? 0
                : selectedExistingPolicy?.patient_insurance_tpa_policy_id || 0,
              copayDeductId: 0, // Will be auto-generated by API
              payableAmntType: payableAmntType,
              chargeGrpName: cg.name,
              isAcrossChargeGroup: 0,
              chargeGrpId: chargeGroupIdMap[cg.name] || null,
              specialityId: 0,
              payableAmountMax: cg.max ? parseFloat(cg.max).toFixed(2) : null,
              isDefault: 1,
              isDeductable: 0,
              isMaternity: 0,
            });
          }
        });
      }

      // Get TPA company ID from config (insurance_id from clinic config)
      const tpaCompanyId = tpaConfig?.insurance_id
        ? typeof tpaConfig.insurance_id === "string"
          ? parseInt(tpaConfig.insurance_id, 10)
          : tpaConfig.insurance_id
        : null;

      // Helper function to convert date from YYYY-MM-DD to YYYY/MM/DD format
      const formatDateForAster = (dateStr: string | null): string | null => {
        if (!dateStr) return null;
        return dateStr.replace(/-/g, "/");
      };

      // Build policy data object
      const policyData = {
        policyId: isNewPolicy
          ? 0
          : selectedExistingPolicy?.patient_insurance_tpa_policy_id || 0,
        isActive: 1,
        // Use selectedPayer.ins_tpaid as payerId (this is the Payer ID from clinic's payer config)
        payerId: selectedPayer?.ins_tpaid || null,
        insuranceCompanyId: null,
        networkId: networkIdNumeric,
        siteId: siteId,
        // policyNumber should be null for new policies, else the policy ID being updated
        policyNumber: isNewPolicy
          ? null
          : selectedExistingPolicy?.patient_insurance_tpa_policy_id || null,
        insuranceGroupPolicyId: null,
        encounterid: finalEncounterId || null,
        parentInsPolicyId: null,
        tpaCompanyId: tpaCompanyId,
        planName: null, // Should be null based on expected payload
        planCode: planCodeFromConfig,
        planId: planIdFromConfig,
        eligibilityReqId: null,
        tpaPolicyId: memberId || null,
        insRules: insRules.length > 0 ? insRules : null,
        orgId: null,
        insuranceMappingId: insuranceMappingId,
        tpaGroupPolicyId: null,
        apntId: finalAppointmentId,
        insuranceValidTill: formatDateForAster(expiryDate),
        orgName: null,
        tpaValidTill: formatDateForAster(expiryDate),
        patientId: finalPatientId,
        insuranceRenewal: null,
        payerType: ltOtherConfig.payerType || 1,
        insuranceStartDate: formatDateForAster(startDate),
        insurancePolicyId: null,
        hasTopUpCard: 0,
        proposerRelation: "Self",
        // createdBy should be current user (13295 or user.id) for new policies,
        // else preserve the original creator from existing policy
        createdBy: isNewPolicy
          ? createdBy
          : selectedExistingPolicy?.created_by || createdBy,
        empId: null,
        requestLetter: null,
        insertType: ltOtherConfig.insertType || 2,
        customerId: customerId,
        type: ltOtherConfig.type || 1,
        relationshipId: ltOtherConfig.relationshipId || 26,
        priorityPatientApplicable: 0,
        typeId: ltOtherConfig.typeId || 2,
        DepData: null,
      };

      console.log("=== FINAL POLICY DATA TO SEND ===");
      console.log("Is New Policy:", isNewPolicy);
      console.log(
        "Selected Existing Policy ID:",
        selectedExistingPolicy?.patient_insurance_tpa_policy_id,
      );
      console.log("Policy Data:", JSON.stringify(policyData, null, 2));
      console.log("Insurance Rules Count:", insRules.length);
      console.log("Insurance Rules:", JSON.stringify(insRules, null, 2));

      const response = await asterApi.savePolicy({
        policyData,
        patientId: finalPatientId,
        appointmentId: finalAppointmentId,
        encounterId: finalEncounterId,
        payerId: selectedPayer?.ins_tpaid || undefined,
      });

      setPolicySaved(true);
      alert("Policy details saved successfully!");
    } catch (error: any) {
      console.error("Error saving policy:", error);
      console.error("Error details:", {
        name: error?.name,
        message: error?.message,
        data: error?.data,
        hasData: !!error?.data,
        dataType: typeof error?.data,
      });

      // Extract error message - the API client returns ApiError with proper error message
      let errorMessage = "An error occurred while saving policy details.";

      // Check if error has data property (ApiError from our API client)
      if (error?.data) {
        console.log("Extracting error from error.data:", error.data);

        // Priority 1: Check for specific error in details.body.Error[0].status_text (most specific)
        if (error.data.details?.body?.Error?.[0]?.status_text) {
          errorMessage = error.data.details.body.Error[0].status_text;
          console.log(
            "✓ Extracted from data.details.body.Error[0].status_text:",
            errorMessage,
          );
        }
        // Priority 2: Check for error in body.Error[0].status_text
        else if (error.data.body?.Error?.[0]?.status_text) {
          errorMessage = error.data.body.Error[0].status_text;
          console.log(
            "✓ Extracted from body.Error[0].status_text:",
            errorMessage,
          );
        }
        // Priority 3: Use generic error message from data.error (only if more specific not found)
        else if (error.data.error) {
          errorMessage = String(error.data.error);
          console.log("✓ Extracted from data.error:", errorMessage);
        }
        // Priority 4: Fallback to error.message
        else if (error.message) {
          errorMessage = error.message;
          console.log("✓ Using error.message:", errorMessage);
        }
      }
      // Fallback to regular error structure (old axios-style error)
      else if (error?.response?.data?.body?.Error) {
        const errors = error.response.data.body.Error;
        if (Array.isArray(errors) && errors.length > 0) {
          const statusText = errors[0].status_text;
          if (statusText) {
            errorMessage = statusText;
            console.log(
              "✓ Extracted from response.data.body.Error[0].status_text:",
              errorMessage,
            );
          }
        }
      }
      // Generic error with message property
      else if (error?.message) {
        errorMessage = error.message;
        console.log("✓ Using error.message:", errorMessage);
      }

      console.log("Final error message to display:", errorMessage);
      alert(errorMessage);
    } finally {
      setSavingPolicy(false);
    }
  };

  if (!data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-lg font-semibold text-red-900">Error</h2>
        <p className="text-red-700">Invalid response</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const benefitCategories =
    keyFields.copayDetails?.map((cat) => ({
      id: cat.name.toLowerCase(),
      label: cat.name,
      network: cat.primary_network.network,
      services: Object.entries(cat.values_to_fill).map(([type, values]) => ({
        type,
        copay: `${values.copay}%`,
        deductible: values.deductible,
        setCopay: values.should_set_copay,
      })),
    })) || [];

  const hasBenefits = benefitCategories.some((cat) => cat.services.length > 0);

  const tabs: { value: TabValue; label: string; icon: React.ReactNode }[] = [
    {
      value: "documents",
      label: "Documents",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      value: "overview",
      label: "Overview",
      icon: <User className="h-4 w-4" />,
    },
    {
      value: "policy",
      label: "Policy Details",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      value: "benefits",
      label: "Copay Details",
      icon: <Hospital className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Action Buttons - 2x2 Grid on Mobile */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleSavePolicy}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="h-4 w-4" /> Save Policy
        </Button>
        {keyFields.referralDocuments?.length > 0 && (
          <Button
            onClick={handleUploadScreenshots}
            disabled={uploadingFiles}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-4 w-4" />{" "}
            {uploadingFiles ? "Uploading..." : "Upload Documents"}
          </Button>
        )}
      </div>

      {/* Tab Navigation - 2x2 on Mobile */}
      <div className="border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === tab.value
                ? "border-blue-600 text-blue-700 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {/* Left Column - 5 items */}
                <div>
                  <p className="text-gray-500">MPI:</p>
                  <p className="font-mono font-medium">{patientMPI || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Patient ID:</p>
                  <p className="font-mono font-medium">
                    {patientId?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Appointment ID:</p>
                  <p className="font-mono font-medium">
                    {appointmentId?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Encounter ID:</p>
                  <p className="font-mono font-medium">
                    {encounterId?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Physician ID:</p>
                  <p className="font-mono font-medium">
                    {physicianId?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Policy Holder:</p>
                  <p className="font-medium">
                    {data.policy_holder_name || "N/A"}
                  </p>
                </div>
                {/* Right Column - 5 items */}
                <div>
                  <p className="text-gray-500">Date of Birth:</p>
                  <p className="font-medium">
                    {data.policy_holder_dob || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Gender:</p>
                  <p className="font-medium">
                    {data.patient_info?.policy_holder_gender || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Member ID:</p>
                  <p className="font-mono font-medium">
                    {keyFields.memberId || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Emirates ID:</p>
                  <p className="font-mono font-medium">
                    {data.policy_holder_emirates_id || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">DHA Member ID:</p>
                  <p className="font-mono font-medium">
                    {data.patient_info?.policy_primary_dha_member_id || "N/A"}
                  </p>
                </div>
              </div>
            </Card>
            {keyFields.specialRemarks?.length > 0 && (
              <Card className="p-4 bg-orange-50 border-orange-200">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-orange-900">
                      Important Remarks
                    </p>
                    <ul className="mt-1 text-sm text-orange-800 space-y-1">
                      {keyFields.specialRemarks.map((remark, idx) => (
                        <li key={idx}>• {remark}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === "benefits" && (
          <div className="space-y-3">
            {hasBenefits ? (
              benefitCategories.map((benefit) => (
                <Card key={benefit.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleSection(benefit.id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        className={
                          benefit.id === "outpatient"
                            ? "bg-green-100 text-green-800"
                            : benefit.id === "inpatient"
                              ? "bg-blue-100 text-blue-800"
                              : benefit.id === "maternity"
                                ? "bg-pink-100 text-pink-800"
                                : "bg-purple-100 text-purple-800"
                        }
                      >
                        {benefit.label}
                      </Badge>
                      <span className="text-sm text-gray-600 truncate">
                        <span className="hidden sm:inline">Network: </span>
                        <span className="font-medium">{benefit.network}</span>
                      </span>
                    </div>
                    {expandedSections.includes(benefit.id) ? (
                      <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                  </button>
                  {expandedSections.includes(benefit.id) &&
                    benefit.services.length > 0 && (
                      <div className="border-t overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                Service
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                Copay
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                                Deductible
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                                Set
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {benefit.services.map((service, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">
                                  {service.type}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {service.copay}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {service.deductible}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {service.setCopay && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center text-gray-500">
                No benefits data available
              </Card>
            )}
          </div>
        )}

        {/* Policy Tab */}
        {activeTab === "policy" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Policy Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Payer</p>
                  <p className="font-medium mt-1">
                    {keyFields.payerName || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Policy Authority</p>
                  <p className="font-medium mt-1">
                    {data.policy_network?.policy_authority || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium mt-1">
                    {keyFields.policyStartDate || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="font-medium mt-1">
                    {keyFields.policyEndDate || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member ID</p>
                  <p className="font-mono mt-1">
                    {keyFields.memberId || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Policy Number</p>
                  <p className="font-mono mt-1">
                    {data.patient_info?.patient_id_info?.policy_number || "N/A"}
                  </p>
                </div>
              </div>
              {data.policy_network?.all_networks?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">
                    Available Networks
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.policy_network.all_networks.map(
                      (n: any, i: number) => (
                        <Badge key={i} className="bg-blue-100 text-blue-800">
                          {n.network_value}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold">Referral Documents</h3>
              </div>
              <div className="space-y-2">
                {keyFields.referralDocuments?.length > 0 ? (
                  keyFields.referralDocuments.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc.s3_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {doc.tag}
                        </span>
                      </div>
                      <Download className="h-4 w-4 text-gray-500 shrink-0" />
                    </a>
                  ))
                ) : (
                  <p className="text-center py-6 text-gray-500">
                    No documents available
                  </p>
                )}
              </div>
              {screenshotSrc && showScreenshot && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Eligibility Screenshot
                  </h4>
                  <a
                    href={screenshotSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-sm hover:border-gray-400 transition-colors"
                  >
                    <img
                      src={screenshotSrc}
                      alt="Eligibility verification screenshot"
                      className="w-full h-auto max-h-[420px] object-contain"
                      onError={() => setShowScreenshot(false)}
                    />
                  </a>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Raw JSON Toggle */}
      <button
        onClick={() => setShowRawJson(!showRawJson)}
        className="w-full flex items-center justify-between p-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <span>View Raw JSON</span>
        {showRawJson ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {showRawJson && (
        <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs max-h-32 overflow-auto">
          {JSON.stringify(
            v3Result ? { response, v3Result } : response,
            null,
            2,
          )}
        </pre>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
        {onCheckAnother && (
          <Button onClick={onCheckAnother} className="flex-1 gap-2">
            Check Another Eligibility
          </Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Modals */}
      <Sidebar
        isOpen={showLifetrenzPreview}
        onClose={() => setShowLifetrenzPreview(false)}
        title="Send to Lifetrenz"
        width="500px"
      >
        <LifetrenzEligibilityPreview
          response={response}
          onClose={() => setShowLifetrenzPreview(false)}
        />
      </Sidebar>

      <Modal
        isOpen={showSavePolicyModal}
        onClose={() => setShowSavePolicyModal(false)}
        title="Insurance Detail - Save Policy"
      >
        <div className="flex flex-col min-h-full">
          {/* Scrollable Content */}
          <div className="flex-1 p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* ========== SECTION 0: Policy Selection ========== */}
            {loadingPolicies ? (
              <div className="border-b pb-4">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">
                    Loading existing policies...
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Select Policy
                </h3>

                {/* Policy Selection Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Policy
                  </label>
                  <Select
                    value={
                      isNewPolicy
                        ? { value: "new", label: "Add New Policy" }
                        : selectedExistingPolicy
                          ? {
                              value:
                                selectedExistingPolicy.patient_insurance_tpa_policy_id,
                              label: `${selectedExistingPolicy.tpa_name || "Unknown TPA"} (Policy ID: ${selectedExistingPolicy.patient_insurance_tpa_policy_id})`,
                            }
                          : null
                    }
                    onChange={(selected) => {
                      if (selected?.value === "new") {
                        setIsNewPolicy(true);
                        setSelectedExistingPolicy(null);
                      } else {
                        const policy = existingPolicies.find(
                          (p: any) =>
                            p.patient_insurance_tpa_policy_id ===
                            selected?.value,
                        );
                        if (policy) {
                          setSelectedExistingPolicy(policy);
                          setIsNewPolicy(false);
                        }
                      }
                    }}
                    options={[
                      ...existingPolicies.map((policy: any) => {
                        const isActive =
                          policy.is_current === 1 ||
                          policy.insurance_status === "active";
                        return {
                          value: policy.patient_insurance_tpa_policy_id,
                          label: `${policy.tpa_name || "Unknown TPA"}${isActive ? " (Active)" : ""} - Policy ID: ${policy.patient_insurance_tpa_policy_id}`,
                        };
                      }),
                      { value: "new", label: "Add New Policy" },
                    ]}
                    placeholder="Select a policy or add new"
                    isSearchable
                    className="text-sm"
                  />
                </div>

                {/* Selected Policy Details (shown when existing policy is selected) */}
                {selectedExistingPolicy && !isNewPolicy && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {selectedExistingPolicy.tpa_name || "Unknown TPA"}
                      </h4>
                      {(selectedExistingPolicy.is_current === 1 ||
                        selectedExistingPolicy.insurance_status ===
                          "active") && (
                        <Badge className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Policy ID:</span>{" "}
                        {selectedExistingPolicy.patient_insurance_tpa_policy_id}
                      </div>
                      <div>
                        <span className="font-medium">Member ID:</span>{" "}
                        {selectedExistingPolicy.tpa_policy_id || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Payer:</span>{" "}
                        {selectedExistingPolicy.payer_name || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Plan:</span>{" "}
                        {selectedExistingPolicy.rate_card_name || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Valid Until:</span>{" "}
                        {selectedExistingPolicy.ins_exp_date
                          ? new Date(
                              selectedExistingPolicy.ins_exp_date,
                            ).toLocaleDateString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                )}

                {/* New Policy Indicator */}
                {isNewPolicy && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-700 font-medium">
                      Creating a new insurance policy record
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ========== SECTION 1: Insurance Policy Information ========== */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Insurance Policy Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Insurance Card # (Member ID) - REQUIRED */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Insurance Card # (Member ID){" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => {
                      console.log("Member ID changed:", e.target.value);
                      setMemberId(e.target.value);
                    }}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Enter member ID"
                  />
                </div>

                {/* Receiver ID - REQUIRED */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Receiver ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiverId}
                    onChange={(e) => {
                      console.log("Receiver ID changed:", e.target.value);
                      setReceiverId(e.target.value);
                    }}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Enter receiver ID"
                  />
                </div>

                {/* Payer - REQUIRED (Searchable Dropdown) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Payer <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={
                      selectedPayer
                        ? {
                            value: selectedPayer.reciever_payer_id,
                            label: selectedPayer.ins_tpa_name,
                          }
                        : null
                    }
                    onChange={(selected) => {
                      if (selected) {
                        const payer = payersConfig.find(
                          (p: any) => p.reciever_payer_id === selected.value,
                        );
                        setSelectedPayer(payer || null);
                      } else {
                        setSelectedPayer(null);
                      }
                    }}
                    options={payersConfig.map((payer: any) => ({
                      value: payer.reciever_payer_id,
                      label: payer.ins_tpa_name,
                    }))}
                    placeholder="Select payer"
                    isSearchable
                    isClearable
                    className="text-sm"
                  />
                </div>

                {/* Plan - REQUIRED (Searchable Dropdown, filtered by network mapping) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Plan <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={
                      selectedPlan
                        ? {
                            value: selectedPlan.plan_id,
                            label: `${selectedPlan.plan_id} - ${selectedPlan.insurance_plan_name}`,
                          }
                        : null
                    }
                    onChange={(selected) => {
                      if (selected) {
                        const plan = plansConfig.find(
                          (p: any) => p.plan_id === selected.value,
                        );
                        setSelectedPlan(plan || null);
                        if (plan) {
                          setRateCard(plan.plan_code || "");
                        }
                      } else {
                        setSelectedPlan(null);
                        setRateCard("");
                      }
                    }}
                    options={(() => {
                      // Filter plans by network mapping if network is selected
                      if (selectedNetwork && planMappings.length > 0) {
                        const mappedPlanIds = planMappings
                          .filter(
                            (m: any) =>
                              m.mantys_network_name === selectedNetwork,
                          )
                          .map((m: any) => m.lt_plan_id);
                        if (mappedPlanIds.length > 0) {
                          return plansConfig
                            .filter((plan: any) =>
                              mappedPlanIds.includes(plan.plan_id),
                            )
                            .map((plan: any) => ({
                              value: plan.plan_id,
                              label: `${plan.plan_id} - ${plan.insurance_plan_name}`,
                            }));
                        }
                      }
                      return plansConfig.map((plan: any) => ({
                        value: plan.plan_id,
                        label: `${plan.plan_id} - ${plan.insurance_plan_name}`,
                      }));
                    })()}
                    placeholder="Select plan"
                    isSearchable
                    isClearable
                    className="text-sm"
                  />
                </div>

                {/* Rate Card (auto-filled from selected plan) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Rate Card
                  </label>
                  <input
                    type="text"
                    value={rateCard}
                    onChange={(e) => setRateCard(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Enter rate card"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Start Date (DD/MM/YYYY)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>

                {/* Last Renewal Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Last Renewal Date (DD/MM/YYYY)
                  </label>
                  <input
                    type="date"
                    value={lastRenewalDate}
                    onChange={(e) => setLastRenewalDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>

                {/* Expiry Date - REQUIRED */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expiry Date (DD/MM/YYYY){" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ========== SECTION 2: Patient Payable ========== */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Patient Payable
              </h3>

              {/* Deductible Radio + Fields */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deductible
                </label>
                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={hasDeductible}
                      onChange={() => setHasDeductible(true)}
                      className="w-4 h-4"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!hasDeductible}
                      onChange={() => setHasDeductible(false)}
                      className="w-4 h-4"
                    />
                    <span>No</span>
                  </label>
                </div>
                {hasDeductible && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Flat *
                      </label>
                      <input
                        type="number"
                        value={deductibleFlat}
                        onChange={(e) => setDeductibleFlat(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Max
                      </label>
                      <input
                        type="number"
                        value={deductibleMax}
                        onChange={(e) => setDeductibleMax(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CoPay Radio */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CoPay
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={hasCopay}
                      onChange={() => setHasCopay(true)}
                      className="w-4 h-4"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!hasCopay}
                      onChange={() => setHasCopay(false)}
                      className="w-4 h-4"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Charge Group Table (shown if CoPay = Yes) */}
              {hasCopay && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Charge Group
                  </label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                            Charge Group
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                            Flat
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                            %
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                            Max
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargeGroups.map((cg, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-3">{cg.name}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={cg.flat}
                                onChange={(e) => {
                                  const updated = [...chargeGroups];
                                  updated[idx].flat = e.target.value;
                                  setChargeGroups(updated);
                                }}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={cg.percent}
                                onChange={(e) => {
                                  const updated = [...chargeGroups];
                                  updated[idx].percent = e.target.value;
                                  setChargeGroups(updated);
                                }}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={cg.max}
                                onChange={(e) => {
                                  const updated = [...chargeGroups];
                                  updated[idx].max = e.target.value;
                                  setChargeGroups(updated);
                                }}
                                className="w-full border border-gray-300 rounded p-1 text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                        {chargeGroups.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-4 px-3 text-center text-gray-500 text-sm"
                            >
                              No charge groups configured. Copay details will be
                              populated from Mantys response.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ========== SECTION 3: Primary Insurance Holder Details Summary ========== */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Primary Insurance Holder Details
              </h3>
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Card #
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Receiver
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Payer
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Plan
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Expiry Date
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Status
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">
                        Relation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-3">{memberId || "-"}</td>
                      <td className="py-2 px-3">{receiverId || "-"}</td>
                      <td className="py-2 px-3">
                        {selectedPayer?.ins_tpa_name || "-"}
                      </td>
                      <td className="py-2 px-3">
                        {selectedPlan
                          ? `${selectedPlan.plan_id} - ${selectedPlan.insurance_plan_name}`
                          : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {expiryDate
                          ? new Date(expiryDate).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          Active
                        </span>
                      </td>
                      <td className="py-2 px-3">Self</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ========== Action Buttons - Sticky Footer ========== */}
          <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 px-6 py-4 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] mt-6 -mx-6 -mb-6 z-10">
            <Button
              variant="outline"
              onClick={() => setShowSavePolicyModal(false)}
              disabled={savingPolicy}
              className="px-6 py-2.5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSavePolicy}
              disabled={savingPolicy || !selectedPlan}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 text-base shadow-md hover:shadow-lg transition-all"
            >
              {savingPolicy ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
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
                  Saving...
                </>
              ) : isNewPolicy ? (
                "Create Insurance Policy"
              ) : (
                "Update Insurance Details"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Dialog for success/error messages from useMantysActions */}
      <StatusDialog
        isOpen={dialogOpen}
        onClose={closeDialog}
        status={dialogStatus}
        title={dialogTitle}
        message={dialogMessage}
        reqId={dialogReqId}
        documentCount={dialogDocumentCount}
        failedCount={dialogFailedCount}
        errorDetails={dialogErrorDetails}
      />
    </div>
  );
};
