/**
 * Mantys Results Display Component
 * Displays the eligibility check results from Mantys API
 */

import React, { useState, useEffect } from "react";
import {
  MantysEligibilityResponse,
  MantysKeyFields,
  CopayDetailsToFill,
} from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Sidebar } from "./ui/sidebar";
import { LifetrenzEligibilityPreview } from "./LifetrenzEligibilityPreview";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "./ui/modal";
import Select from "react-select";

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

export const MantysResultsDisplay: React.FC<MantysResultsDisplayProps> = ({
  response,
  onClose,
  onCheckAnother,
  screenshot,
  patientMPI,
  patientId,
  appointmentId,
  encounterId,
  physicianId: propPhysicianId,
}) => {
  const [expandedCopay, setExpandedCopay] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [tpaConfig, setTpaConfig] = useState<any>(null);
  const [plansConfig, setPlansConfig] = useState<any[]>([]);
  const [networksConfig, setNetworksConfig] = useState<any[]>([]);
  const [asterNetworksConfig, setAsterNetworksConfig] = useState<any[]>([]); // Networks with numeric IDs from Aster
  const [planMappings, setPlanMappings] = useState<any[]>([]);
  const [payersConfig, setPayersConfig] = useState<any[]>([]);
  const [showSavePolicyModal, setShowSavePolicyModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  // Editable form fields
  const [memberId, setMemberId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [selectedPayer, setSelectedPayer] = useState<any | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [lastRenewalDate, setLastRenewalDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [rateCard, setRateCard] = useState<string>("");
  const [hasDeductible, setHasDeductible] = useState<boolean>(false);
  const [deductibleFlat, setDeductibleFlat] = useState<string>("");
  const [deductibleMax, setDeductibleMax] = useState<string>("");
  const [hasCopay, setHasCopay] = useState<boolean>(false);
  const [chargeGroups, setChargeGroups] = useState<Array<{
    name: string;
    flat: string;
    percent: string;
    max: string;
  }>>([]);

  // Get user and clinic context
  const { user } = useAuth();
  const selectedClinicId = user?.selected_team_id || null;

  // Enriched patient context (fetched from Redis if props are missing)
  const [enrichedPatientId, setEnrichedPatientId] = useState<number | undefined>(patientId);
  const [enrichedAppointmentId, setEnrichedAppointmentId] = useState<number | undefined>(appointmentId);
  const [enrichedEncounterId, setEnrichedEncounterId] = useState<number | undefined>(encounterId);
  const [enrichedPhysicianId, setEnrichedPhysicianId] = useState<number | undefined>(propPhysicianId);
  const [insTpaPatId, setInsTpaPatId] = useState<number | undefined>(undefined);

  // Fetch patient context from Redis if patientId or appointmentId are missing
  useEffect(() => {
    const fetchPatientContext = async () => {
      // If we already have both IDs, no need to fetch
      if (patientId && appointmentId) {
        setEnrichedPatientId(patientId);
        setEnrichedAppointmentId(appointmentId);
        setEnrichedEncounterId(encounterId);
        return;
      }

      // Try to fetch from Redis using available identifiers
      if (patientMPI || appointmentId || patientId) {
        try {
          console.log("🔍 Fetching patient context from Redis for upload:", {
            appointmentId,
            patientId,
            mpi: patientMPI,
          });

          const contextResponse = await fetch("/api/patient/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId: appointmentId,
              patientId: patientId,
              mpi: patientMPI,
            }),
          });

          if (contextResponse.ok) {
            const context = await contextResponse.json();
            console.log("✅ Enriched patient context from Redis:", context);

            // Only update if we got valid values
            if (context.patientId) {
              setEnrichedPatientId(context.patientId);
            }
            if (context.appointmentId) {
              setEnrichedAppointmentId(context.appointmentId);
            }
            if (context.encounterId !== undefined) {
              setEnrichedEncounterId(context.encounterId);
            }
          } else {
            console.warn("⚠️ Redis context not found, status:", contextResponse.status);
          }
        } catch (error) {
          console.error("❌ Could not fetch patient context from Redis:", error);
        }
      }
    };

    fetchPatientContext();
  }, [patientMPI, appointmentId, patientId, encounterId]);

  // Fetch appointment data to get physician ID and insurance details to get insTpaPatId
  useEffect(() => {
    const fetchAppointmentAndInsuranceData = async () => {
      // If we already have physicianId from props, use it
      if (propPhysicianId) {
        setEnrichedPhysicianId(propPhysicianId);
      }

      const finalAppointmentId = enrichedAppointmentId || appointmentId;
      const finalPatientId = enrichedPatientId || patientId;
      const finalEncounterId = enrichedEncounterId || encounterId;

      // First, try to fetch from Redis using appointment ID
      if (finalAppointmentId) {
        try {
          console.log("🔍 Fetching appointment context from Redis for appointment:", finalAppointmentId);
          const contextResponse = await fetch("/api/patient/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId: finalAppointmentId,
            }),
          });

          if (contextResponse.ok) {
            const context = await contextResponse.json();
            console.log("✅ Found appointment context in Redis:", {
              physician_id: context.physician_id,
              hasInsuranceDetails: !!context.insuranceDetails,
            });

            // Extract physician_id from Redis context
            if (!propPhysicianId && context.physician_id) {
              console.log("✅ Found physician_id from Redis:", context.physician_id);
              setEnrichedPhysicianId(context.physician_id);
            }

            // Extract insTpaPatId from nested insuranceDetails in Redis context
            if (!insTpaPatId && context.insuranceDetails?.body?.Data && Array.isArray(context.insuranceDetails.body.Data)) {
              const insuranceRecords = context.insuranceDetails.body.Data;
              console.log(`📋 Found ${insuranceRecords.length} insurance record(s) in Redis context`);

              // Use the first entry
              const selectedInsurance = insuranceRecords[0];

              // Use patient_insurance_tpa_policy_id_sites (equivalent to insTpaPatId) or fallback to patient_insurance_tpa_policy_id
              const insTpaPatIdValue = selectedInsurance?.patient_insurance_tpa_policy_id_sites || selectedInsurance?.patient_insurance_tpa_policy_id;
              if (insTpaPatIdValue) {
                console.log("✅ Selected insurance from Redis (first entry):", {
                  insTpaPatId: insTpaPatIdValue,
                  status: selectedInsurance.insurance_status,
                  payer_name: selectedInsurance.payer_name,
                  tpa_name: selectedInsurance.tpa_name,
                  total_records: insuranceRecords.length,
                });
                setInsTpaPatId(insTpaPatIdValue);
              } else {
                console.warn("⚠️ Selected insurance record but no insTpaPatId value found:", selectedInsurance);
              }
            }
          } else {
            console.log("⚠️ Appointment context not found in Redis, will fetch from API");
          }
        } catch (error) {
          console.error("❌ Error fetching appointment context from Redis:", error);
        }
      }

      // Fallback: Fetch appointment data to get physician_id if not found in Redis
      if (!propPhysicianId && !enrichedPhysicianId && finalAppointmentId) {
        try {
          const today = new Date();
          const fromDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
          const response = await fetch(`/api/appointments/today?fromDate=${fromDate}&toDate=${fromDate}`);
          if (response.ok) {
            const data = await response.json();
            if (data.body?.Data && Array.isArray(data.body.Data)) {
              const appointment = data.body.Data.find(
                (apt: any) => apt.appointment_id === finalAppointmentId
              );
              if (appointment?.physician_id) {
                console.log("✅ Found physician_id from appointment API:", appointment.physician_id);
                setEnrichedPhysicianId(appointment.physician_id);
              }
            }
          }
        } catch (error) {
          console.error("❌ Error fetching appointment data:", error);
        }
      }

      // Fallback: Fetch insurance details to get patient_insurance_tpa_policy_id (insTpaPatId) if not found in Redis
      if (finalPatientId && !insTpaPatId && finalAppointmentId) {
        try {
          const { getInsuranceDetails } = await import("../lib/api");
          const insuranceResponse = await getInsuranceDetails({
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
            const insuranceRecords = insuranceResponse.body.Data;
            console.log(`📋 Fetched ${insuranceRecords.length} insurance record(s) from API`);

            // Use the first entry
            const selectedInsurance = insuranceRecords[0];

            // Use patient_insurance_tpa_policy_id_sites (equivalent to insTpaPatId) or fallback to patient_insurance_tpa_policy_id
            const insTpaPatIdValue = selectedInsurance?.patient_insurance_tpa_policy_id_sites || selectedInsurance?.patient_insurance_tpa_policy_id;
            if (insTpaPatIdValue) {
              console.log("✅ Selected insurance from API (first entry):", {
                insTpaPatId: insTpaPatIdValue,
                status: selectedInsurance.insurance_status,
                payer_name: selectedInsurance.payer_name,
                tpa_name: selectedInsurance.tpa_name,
                total_records: insuranceRecords.length,
              });
              setInsTpaPatId(insTpaPatIdValue);
            } else {
              console.warn("⚠️ Selected insurance record but no insTpaPatId value found:", selectedInsurance);
            }
          }

          // Store insurance details in Redis nested in appointment context
          if (finalAppointmentId && insuranceResponse) {
            try {
              console.log("💾 Storing insurance details in Redis for appointment:", finalAppointmentId);
              const updateResponse = await fetch("/api/patient/context/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  appointmentId: finalAppointmentId,
                  updates: {
                    insuranceDetails: insuranceResponse,
                  },
                }),
              });

              if (updateResponse.ok) {
                console.log("✅ Stored insurance details in Redis");
              } else {
                console.warn("⚠️ Failed to store insurance details in Redis:", updateResponse.status);
              }
            } catch (updateError) {
              console.error("❌ Error storing insurance details in Redis:", updateError);
            }
          }
        } catch (error) {
          console.error("❌ Error fetching insurance details:", error);
        }
      }
    };

    fetchAppointmentAndInsuranceData();
  }, [enrichedAppointmentId, enrichedPatientId, enrichedEncounterId, appointmentId, patientId, encounterId, propPhysicianId, insTpaPatId, enrichedPhysicianId]);

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;

  // Load TPA config and plans when component mounts or TPA changes
  useEffect(() => {
    const loadTPAConfig = async () => {
      if (!selectedClinicId || !response.tpa) return;

      try {
        console.log("🔍 Loading TPA config for save policy:", response.tpa, "clinic:", selectedClinicId);
        const configResponse = await fetch(`/api/clinic-config/tpa?clinic_id=${selectedClinicId}`);
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.configs && Array.isArray(configData.configs)) {
            let config: any = null;
            let tpaInsCodeToUse: string | null = null;

            // PRIORITY 1: Try to extract payer code from payer_name first (most reliable)
            if (data?.policy_network?.payer_name) {
              const payerName = data.policy_network.payer_name;
              console.log("🔍 PRIORITY: Extracting payer code from payer_name:", payerName);
              // Extract payer code from payer_name (e.g., "QATAR INSURANCE COMPANY - INS019" -> "INS019")
              const codeMatch = payerName.match(/\b(INS|TPA|SP|A|D)\d+\b/i);
              if (codeMatch) {
                const extractedCode = codeMatch[0].toUpperCase().trim();
                console.log("📋 Extracted payer code from payer_name:", extractedCode);
                // Try to find TPA config by this extracted code
                config = configData.configs.find((c: any) => c.ins_code === extractedCode);
                if (!config) {
                  config = configData.configs.find((c: any) => c.tpa_id === extractedCode);
                }
                if (!config) {
                  config = configData.configs.find((c: any) => c.payer_code === extractedCode);
                }
                if (config) {
                  console.log("✅ Found TPA config by extracted payer code from payer_name:", extractedCode);
                  tpaInsCodeToUse = config.ins_code || extractedCode;
                }
              }
            }

            // FALLBACK: If not found from payer_name, try to find config by response.tpa
            if (!config) {
              console.log("🔍 FALLBACK: Trying to find TPA config by response.tpa:", response.tpa);
              config = configData.configs.find(
                (c: any) => c.ins_code === response.tpa
              );
              if (!config) {
                config = configData.configs.find(
                  (c: any) => c.tpa_id === response.tpa
                );
              }
              if (!config) {
                config = configData.configs.find(
                  (c: any) => c.payer_code === response.tpa
                );
              }
              if (config) {
                console.log("✅ Found TPA config by response.tpa:", response.tpa);
                tpaInsCodeToUse = config.ins_code || response.tpa;
              }
            }

            if (config) {
              console.log("✅ Found TPA config for save policy:", {
                ins_code: config.ins_code,
                tpa_name: config.tpa_name,
                hospital_insurance_mapping_id: config.hospital_insurance_mapping_id,
                lt_site_id: config.lt_site_id,
                lt_customer_id: config.lt_customer_id,
                lt_other_config: config.lt_other_config
              });
              setTpaConfig(config);

              // Load plans, networks, and plan mappings for this TPA
              const tpaInsCode = tpaInsCodeToUse || config.ins_code || response.tpa;
              try {
                // Load plans
                const plansResponse = await fetch(`/api/clinic-config/plans?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
                if (plansResponse.ok) {
                  const plansData = await plansResponse.json();
                  // Handle both response formats: { plans, tpa_ins_code } or { plans_by_tpa: {...} }
                  let plans: any[] = [];
                  if (plansData.plans && Array.isArray(plansData.plans)) {
                    plans = plansData.plans;
                  } else if (plansData.plans_by_tpa && plansData.plans_by_tpa[tpaInsCode]) {
                    plans = plansData.plans_by_tpa[tpaInsCode];
                  }
                  if (plans.length > 0) {
                    setPlansConfig(plans);
                    console.log("✅ Loaded plans config:", plans.length, "plans for TPA:", tpaInsCode);
                  }
                }

                // Load Mantys networks (for display/matching)
                const networksResponse = await fetch(`/api/clinic-config/mantys-networks?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
                if (networksResponse.ok) {
                  const networksData = await networksResponse.json();
                  if (networksData.networks && Array.isArray(networksData.networks)) {
                    setNetworksConfig(networksData.networks);
                    console.log("✅ Loaded Mantys networks config:", networksData.networks.length, "networks for TPA:", tpaInsCode);
                  }
                }

                // Load Aster networks config (with numeric network_id)
                const asterNetworksResponse = await fetch(`/api/clinic-config/networks?clinic_id=${selectedClinicId}`);
                if (asterNetworksResponse.ok) {
                  const asterNetworksData = await asterNetworksResponse.json();
                  if (asterNetworksData.configs && Array.isArray(asterNetworksData.configs)) {
                    setAsterNetworksConfig(asterNetworksData.configs);
                    console.log("✅ Loaded Aster networks config:", asterNetworksData.configs.length, "networks with IDs");
                  }
                }

                // Load plan mappings
                const mappingsResponse = await fetch(`/api/clinic-config/plan-mappings?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
                if (mappingsResponse.ok) {
                  const mappingsData = await mappingsResponse.json();
                  if (mappingsData.mappings && Array.isArray(mappingsData.mappings)) {
                    setPlanMappings(mappingsData.mappings);
                    console.log("✅ Loaded plan mappings:", mappingsData.mappings.length, "mappings for TPA:", tpaInsCode);
                  }
                }

                // Load payers
                const payersResponse = await fetch(`/api/clinic-config/payers?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
                if (payersResponse.ok) {
                  const payersData = await payersResponse.json();
                  if (payersData.payers && Array.isArray(payersData.payers)) {
                    setPayersConfig(payersData.payers);
                    console.log("✅ Loaded payers config:", payersData.payers.length, "payers for TPA:", tpaInsCode);
                  }
                }
              } catch (error) {
                console.error("❌ Failed to load config data:", error);
              }
            } else {
              console.log("⚠️ No TPA config found for:", response.tpa);
            }
          }
        }
      } catch (error) {
        console.error("❌ Failed to load TPA config for save policy:", error);
      }
    };

    loadTPAConfig();
  }, [selectedClinicId, response.tpa]);

  // Auto-select plan when network is selected based on plan-network mappings
  useEffect(() => {
    if (!selectedNetwork || planMappings.length === 0 || plansConfig.length === 0) {
      return;
    }

    // Find mappings for the selected network (try multiple matching strategies)
    let networkMappings: any[] = [];

    // Strategy 1: Direct match by network name
    networkMappings = planMappings.filter(
      (m: any) => m.mantys_network_name === selectedNetwork
    );

    // Strategy 2: Try to match by network value from Mantys response
    if (networkMappings.length === 0) {
      const mantysNetwork = data.policy_network?.all_networks?.find(
        (n: any) => n.network_value === selectedNetwork || n.network === selectedNetwork
      );
      if (mantysNetwork) {
        // Try network name as in text
        if (mantysNetwork.network_name_as_in_text) {
          const textMappings = planMappings.filter(
            (m: any) => m.mantys_network_name === mantysNetwork.network_name_as_in_text
          );
          if (textMappings.length > 0) {
            networkMappings = textMappings;
          }
        }
        // Try network value
        if (networkMappings.length === 0 && mantysNetwork.network_value) {
          const valueMappings = planMappings.filter(
            (m: any) => m.mantys_network_name === mantysNetwork.network_value
          );
          if (valueMappings.length > 0) {
            networkMappings = valueMappings;
          }
        }
        // Try network code
        if (networkMappings.length === 0 && mantysNetwork.network) {
          const codeMappings = planMappings.filter(
            (m: any) => m.mantys_network_name === mantysNetwork.network
          );
          if (codeMappings.length > 0) {
            networkMappings = codeMappings;
          }
        }
      }
    }

    // Strategy 3: Case-insensitive partial match
    if (networkMappings.length === 0) {
      const selectedNetworkLower = selectedNetwork.toLowerCase();
      networkMappings = planMappings.filter((m: any) => {
        const mappingNetworkLower = (m.mantys_network_name || "").toLowerCase();
        return mappingNetworkLower === selectedNetworkLower ||
          mappingNetworkLower.includes(selectedNetworkLower) ||
          selectedNetworkLower.includes(mappingNetworkLower);
      });
    }

    if (networkMappings.length > 0) {
      // Prefer default mapping, otherwise use first one
      const defaultMapping = networkMappings.find((m: any) => m.is_default);
      const mappingToUse = defaultMapping || networkMappings[0];

      // Find the plan from config
      const mappedPlan = plansConfig.find(
        (p: any) => p.plan_id === mappingToUse.lt_plan_id
      );

      if (mappedPlan && (!selectedPlan || selectedPlan.plan_id !== mappedPlan.plan_id)) {
        console.log("✅ Auto-selected plan from network mapping:", {
          network: selectedNetwork,
          planId: mappedPlan.plan_id,
          planName: mappedPlan.insurance_plan_name,
          planCode: mappedPlan.plan_code,
          isDefault: mappingToUse.is_default,
          mappingNetworkName: mappingToUse.mantys_network_name,
        });
        setSelectedPlan(mappedPlan);
      }
    } else {
      console.log("⚠️ No plan mapping found for network:", selectedNetwork);
    }
  }, [selectedNetwork, planMappings, plansConfig, data.policy_network]);

  // Auto-match payer when payersConfig becomes available (backup mechanism)
  // This ensures payer is matched even if payersConfig loads after the modal is opened
  useEffect(() => {
    // Only run if modal is open, payers are loaded, and payer is not already selected
    if (!showSavePolicyModal || payersConfig.length === 0 || selectedPayer) {
      return;
    }

    // Extract payer code from multiple possible sources
    let payerCodeToMatch: string | null = null;

    // 1. PRIORITY: Extract payer code from payer_name (e.g., "DUBAI INSURANCE COMPANY - INS005")
    // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
    if (data.policy_network?.payer_name) {
      const payerName = data.policy_network.payer_name;
      // Match patterns: INS, TPA, A, or D followed by digits only (not letters)
      const codeMatch = payerName.match(/\b(INS|TPA|SP|A|D)\d+\b/i);
      if (codeMatch) {
        payerCodeToMatch = codeMatch[0].toUpperCase().trim();
      }
    }

    // 2. Check if payer_id matches valid payer code pattern (INS, TPA, A, or D followed by digits only)
    if (!payerCodeToMatch && data.payer_id) {
      const payerIdTrimmed = String(data.payer_id).trim().toUpperCase();
      // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
      if (/^(INS|TPA|SP|A|D)\d+$/.test(payerIdTrimmed)) {
        payerCodeToMatch = payerIdTrimmed;
      }
    }

    // 3. Fallback: try patient_info.payer_id as payer code
    if (!payerCodeToMatch && data.patient_info?.payer_id) {
      const patientPayerIdTrimmed = String(data.patient_info.payer_id).trim().toUpperCase();
      // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
      if (/^(INS|TPA|SP|A|D)\d+$/.test(patientPayerIdTrimmed)) {
        payerCodeToMatch = patientPayerIdTrimmed;
      }
    }

    if (payerCodeToMatch) {
      // Match by ins_tpa_code (payer code) - case-insensitive and trim whitespace
      const matchingPayer = payersConfig.find((p: any) => {
        const configCode = String(p.ins_tpa_code || '').trim().toUpperCase();
        const matchCode = payerCodeToMatch!.trim().toUpperCase();
        return configCode === matchCode;
      });

      if (matchingPayer) {
        console.log('✅ Auto-filled payer (late load):', matchingPayer.ins_tpa_name, 'from payer code:', payerCodeToMatch);
        setSelectedPayer(matchingPayer);
      } else {
        // Fallback: try matching by receiver_payer_id if payer_id is numeric
        if (data.patient_info?.payer_id) {
          const payerIdNum = parseInt(data.patient_info.payer_id, 10);
          if (!isNaN(payerIdNum)) {
            const matchingPayerById = payersConfig.find((p: any) =>
              p.reciever_payer_id === payerIdNum || String(p.reciever_payer_id) === data.patient_info.payer_id
            );
            if (matchingPayerById) {
              console.log('✅ Auto-filled payer (late load, fallback by ID):', matchingPayerById.ins_tpa_name);
              setSelectedPayer(matchingPayerById);
            }
          }
        }
      }
    }
  }, [showSavePolicyModal, payersConfig, selectedPayer, data.payer_id, data.policy_network?.payer_name, data.patient_info?.payer_id]);

  // Guard against undefined data - but check if we have error info first
  if (!data) {
    // Check if response has status/message/error_type for better error display
    const errorMessage = (response as any).message ||
      (response as any).error_type ||
      'The eligibility check response is missing data. Please try again.';
    const responseStatus = (response as any).status;

    console.error('MantysResultsDisplay - Missing data. Full response:', response);

    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-900 mb-2">
          {responseStatus === 'member_not_found' ? 'Member Not Found' : 'Error: Invalid Response'}
        </h2>
        <p className="text-red-700">
          {errorMessage}
        </p>
        {(response as any).tpa && (
          <p className="text-sm text-gray-600 mt-2">
            TPA: {(response as any).tpa}
          </p>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const toggleCopayExpanded = (name: string) => {
    setExpandedCopay(expandedCopay === name ? null : name);
  };

  const handleSendToLifetrenz = () => {
    setShowLifetrenzPreview(true);
  };

  const handleCloseLifetrenzPreview = () => {
    setShowLifetrenzPreview(false);
  };

  const handleSavePolicy = async () => {
    const finalPatientId = enrichedPatientId || patientId;
    const finalAppointmentId = enrichedAppointmentId || appointmentId;

    if (!finalPatientId || !finalAppointmentId) {
      alert(
        "Missing required patient information (Patient ID or Appointment ID). Cannot save policy details.",
      );
      return;
    }

    // Helper function to load payers config if not already loaded
    const ensurePayersConfigLoaded = async (): Promise<any[]> => {
      // If payers are already loaded, return them
      if (payersConfig.length > 0) {
        return payersConfig;
      }

      // Otherwise, try to load them on-demand
      if (!selectedClinicId || !response.tpa) {
        console.log('⚠️ Cannot load payers: missing clinic ID or TPA');
        return [];
      }

      try {
        console.log('🔄 PayersConfig not loaded yet, loading on-demand...');

        // First, try to get TPA config to get the ins_code
        const configResponse = await fetch(`/api/clinic-config/tpa?clinic_id=${selectedClinicId}`);
        if (!configResponse.ok) {
          console.log('⚠️ Could not load TPA config');
          return [];
        }

        const configData = await configResponse.json();
        if (!configData.configs || !Array.isArray(configData.configs)) {
          console.log('⚠️ Invalid TPA config response');
          return [];
        }

        // Find TPA config
        let config: any = null;
        let tpaInsCodeToUse: string | null = null;

        // PRIORITY 1: Try to extract payer code from payer_name first (most reliable)
        if (data.policy_network?.payer_name) {
          const payerName = data.policy_network.payer_name;
          console.log('🔍 PRIORITY: Extracting payer code from payer_name:', payerName);
          // Extract payer code from payer_name (e.g., "QATAR INSURANCE COMPANY - INS019" -> "INS019")
          const codeMatch = payerName.match(/\b(INS|TPA|SP|A|D)\d+\b/i);
          if (codeMatch) {
            const extractedCode = codeMatch[0].toUpperCase().trim();
            console.log('📋 Extracted payer code from payer_name:', extractedCode);
            // Try to find TPA config by this extracted code
            config = configData.configs.find((c: any) => c.ins_code === extractedCode);
            if (!config) {
              config = configData.configs.find((c: any) => c.tpa_id === extractedCode);
            }
            if (!config) {
              config = configData.configs.find((c: any) => c.payer_code === extractedCode);
            }
            if (config) {
              console.log('✅ Found TPA config by extracted payer code from payer_name:', extractedCode);
              tpaInsCodeToUse = config.ins_code || extractedCode;
            }
          }
        }

        // FALLBACK: If not found from payer_name, try to find config by response.tpa
        if (!config) {
          console.log('🔍 FALLBACK: Trying to find TPA config by response.tpa:', response.tpa);
          config = configData.configs.find((c: any) => c.ins_code === response.tpa);
          if (!config) {
            config = configData.configs.find((c: any) => c.tpa_id === response.tpa);
          }
          if (!config) {
            config = configData.configs.find((c: any) => c.payer_code === response.tpa);
          }
          if (config) {
            console.log('✅ Found TPA config by response.tpa:', response.tpa);
            tpaInsCodeToUse = config.ins_code || response.tpa;
          }
        }

        if (!config) {
          console.log('⚠️ No TPA config found for:', response.tpa);
          if (data.policy_network?.payer_name) {
            console.log('⚠️ Also tried extracting from payer_name:', data.policy_network.payer_name);
          }
          return [];
        }

        const tpaInsCode = tpaInsCodeToUse || config.ins_code || response.tpa;

        // Load payers
        const payersResponse = await fetch(`/api/clinic-config/payers?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
        if (payersResponse.ok) {
          const payersData = await payersResponse.json();
          if (payersData.payers && Array.isArray(payersData.payers)) {
            console.log('✅ Loaded payers config on-demand:', payersData.payers.length, 'payers');
            setPayersConfig(payersData.payers);
            return payersData.payers;
          }
        }
      } catch (error) {
        console.error('❌ Failed to load payers config on-demand:', error);
      }

      return [];
    };

    // Initialize form fields from Mantys response
    setMemberId(data.patient_info?.patient_id_info?.member_id || data.patient_info?.policy_primary_member_id || "");
    setReceiverId(tpaConfig?.tpa_name || response.tpa || "");

    // Set default selections based on Mantys response
    if (data.policy_network?.all_networks && data.policy_network.all_networks.length > 0) {
      const firstNetwork = data.policy_network.all_networks[0];
      setSelectedNetwork(firstNetwork.network_value || firstNetwork.network || null);
    }

    // Try to find matching plan from Mantys response
    const planNameFromMantys = data.patient_info?.plan_name;
    if (planNameFromMantys && plansConfig.length > 0) {
      const matchingPlan = plansConfig.find((plan: any) => {
        const planName = plan.insurance_plan_name?.toLowerCase() || "";
        const mantysPlanName = planNameFromMantys.toLowerCase();
        return planName === mantysPlanName || planName.includes(mantysPlanName) || mantysPlanName.includes(planName);
      });
      if (matchingPlan) {
        setSelectedPlan(matchingPlan);
        setRateCard(matchingPlan.plan_code || "");
      }
    }

    // Helper function to parse date from various formats
    const parseDateToISO = (dateValue: any): string | null => {
      if (!dateValue) return null;

      // If it's already in YYYY-MM-DD format, return as is
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }

      // If it's an object with DD, MM, YYYY (from policy_period_end)
      if (typeof dateValue === 'object' && dateValue.DD && dateValue.MM && dateValue.YYYY) {
        const day = String(dateValue.DD).padStart(2, '0');
        const month = String(dateValue.MM).padStart(2, '0');
        const year = dateValue.YYYY;
        return `${year}-${month}-${day}`;
      }

      // Try to parse as date string
      if (typeof dateValue === 'string') {
        const dateObj = new Date(dateValue);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split('T')[0];
        }
      }

      return null;
    };

    // Set start date - check multiple sources
    const startDateValue = data.policy_start_date ||
      data.policy_network?.start_date ||
      (data.copay_analysis?.new_version_of_copay_analysis?.policy_info?.policy_period_start);
    const parsedStartDate = parseDateToISO(startDateValue);
    if (parsedStartDate) {
      setStartDate(parsedStartDate);
      console.log('✅ Auto-filled start date:', parsedStartDate, 'from source:', startDateValue);
    }

    // Set expiry date - check multiple sources (priority: policy_end_date > valid_upto > policy_period_end)
    const expiryDateValue = data.policy_end_date ||
      data.policy_network?.valid_upto ||
      (data.copay_analysis?.new_version_of_copay_analysis?.policy_info?.policy_period_end);
    const parsedExpiryDate = parseDateToISO(expiryDateValue);
    if (parsedExpiryDate) {
      setExpiryDate(parsedExpiryDate);
      console.log('✅ Auto-filled expiry date:', parsedExpiryDate, 'from source:', expiryDateValue);
    } else {
      console.log('⚠️ Could not parse expiry date from:', {
        policy_end_date: data.policy_end_date,
        valid_upto: data.policy_network?.valid_upto,
        policy_period_end: data.copay_analysis?.new_version_of_copay_analysis?.policy_info?.policy_period_end
      });
    }

    // Map copay details to charge groups
    const copayDetails = data.copay_details_to_fill?.[0]; // Use first copay detail (usually Outpatient)
    if (copayDetails?.values_to_fill) {
      const chargeGroupsData: Array<{ name: string; flat: string; percent: string; max: string }> = [];
      const values = copayDetails.values_to_fill;

      // Map charge groups
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
          max: values.MEDICINES._maxDeductible || values.MEDICINES.deductible || "0",
        });
      }
      if (values.RADIOLOGY) {
        chargeGroupsData.push({
          name: "Radiology",
          flat: values.RADIOLOGY.copay || "0",
          percent: "0",
          max: values.RADIOLOGY._maxDeductible || values.RADIOLOGY.deductible || "0",
        });
      }
      if (values.CONSULTATION) {
        chargeGroupsData.push({
          name: "Consultation",
          flat: values.CONSULTATION.copay || "0",
          percent: "0",
          max: values.CONSULTATION._maxDeductible || values.CONSULTATION.deductible || "0",
        });
      }
      if (values.PROCEDURE) {
        chargeGroupsData.push({
          name: "Procedure",
          flat: values.PROCEDURE.copay || "0",
          percent: "0",
          max: values.PROCEDURE._maxDeductible || values.PROCEDURE.deductible || "0",
        });
      }
      if (values["DENTAL CONSULTATION & PROCEDURE"]) {
        chargeGroupsData.push({
          name: "Dental",
          flat: values["DENTAL CONSULTATION & PROCEDURE"].copay || "0",
          percent: "0",
          max: values["DENTAL CONSULTATION & PROCEDURE"]._maxDeductible || values["DENTAL CONSULTATION & PROCEDURE"].deductible || "0",
        });
      }

      setChargeGroups(chargeGroupsData);

      // Set deductible and copay flags
      const hasAnyDeductible = chargeGroupsData.some(cg => parseFloat(cg.max) > 0);
      const hasAnyCopay = chargeGroupsData.some(cg => parseFloat(cg.flat) > 0);
      setHasDeductible(hasAnyDeductible);
      setHasCopay(hasAnyCopay);

      // Set deductible values (use max from charge groups or first deductible)
      if (hasAnyDeductible) {
        const maxDeductible = chargeGroupsData.find(cg => parseFloat(cg.max) > 0)?.max || "0";
        setDeductibleMax(maxDeductible);
        setDeductibleFlat(chargeGroupsData.find(cg => parseFloat(cg.flat) > 0)?.flat || "0");
      }
    }

    // Ensure payers config is loaded before trying to match
    const currentPayersConfig = await ensurePayersConfigLoaded();

    // Try to find payer from config by matching payer code
    console.log('🔍 Attempting to match payer. PayersConfig length:', currentPayersConfig.length);
    if (currentPayersConfig.length > 0) {
      // Extract payer code from multiple possible sources
      // NOTE: TPA codes (like TPA036) are NOT payer codes - payer codes are INS codes (like INS005, INS038)
      let payerCodeToMatch: string | null = null;

      // 1. PRIORITY: Extract payer code from payer_name (e.g., "DUBAI INSURANCE COMPANY - INS005" or "NATIONAL GENERAL INSURANCE COMPANY - DHA - INS038")
      // This is the most reliable source as it contains the actual insurance company code
      // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
      if (data.policy_network?.payer_name) {
        const payerName = data.policy_network.payer_name;
        console.log('📋 Checking payer_name for code:', payerName);
        // Match patterns: INS, TPA, A, or D followed by digits only (not letters)
        const codeMatch = payerName.match(/\b(INS|TPA|SP|A|D)\d+\b/i);
        if (codeMatch) {
          payerCodeToMatch = codeMatch[0].toUpperCase().trim();
          console.log('📋 Extracted payer code from payer_name:', payerCodeToMatch);
        }
      }

      // 2. Check if payer_id matches valid payer code pattern (INS, TPA, A, or D followed by digits only)
      if (!payerCodeToMatch && data.payer_id) {
        const payerIdTrimmed = String(data.payer_id).trim().toUpperCase();
        // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
        if (/^(INS|TPA|SP|A|D)\d+$/.test(payerIdTrimmed)) {
          payerCodeToMatch = payerIdTrimmed;
          console.log('📋 Extracted payer code from data.payer_id:', payerCodeToMatch);
        } else {
          console.log('⚠️ payer_id does not match valid payer code pattern (INS/TPA/A/D followed by digits):', payerIdTrimmed);
        }
      }

      // 3. Fallback: try patient_info.payer_id as payer code
      if (!payerCodeToMatch && data.patient_info?.payer_id) {
        const patientPayerIdTrimmed = String(data.patient_info.payer_id).trim().toUpperCase();
        // Valid patterns: INS012, TPA102, A004, D001 (prefix followed by digits only)
        if (/^(INS|TPA|SP|A|D)\d+$/.test(patientPayerIdTrimmed)) {
          payerCodeToMatch = patientPayerIdTrimmed;
          console.log('📋 Extracted payer code from patient_info.payer_id:', payerCodeToMatch);
        } else {
          console.log('⚠️ patient_info.payer_id does not match valid payer code pattern (INS/TPA/A/D followed by digits):', patientPayerIdTrimmed);
        }
      }

      if (payerCodeToMatch) {
        console.log('🔍 Looking for payer with code:', payerCodeToMatch);
        console.log('🔍 Available payer codes in config:', currentPayersConfig.map((p: any) => ({
          code: p.ins_tpa_code,
          name: p.ins_tpa_name,
          id: p.reciever_payer_id
        })));

        // Match by ins_tpa_code (payer code) - case-insensitive and trim whitespace
        const matchingPayer = currentPayersConfig.find((p: any) => {
          const configCode = String(p.ins_tpa_code || '').trim().toUpperCase();
          const matchCode = payerCodeToMatch!.trim().toUpperCase();
          return configCode === matchCode;
        });

        if (matchingPayer) {
          console.log('✅ Auto-filled payer:', matchingPayer.ins_tpa_name, 'from payer code:', payerCodeToMatch, 'receiver_payer_id:', matchingPayer.reciever_payer_id);
          setSelectedPayer(matchingPayer);
        } else {
          console.log('⚠️ Could not find matching payer for payer code:', payerCodeToMatch);
          console.log('⚠️ Available payer codes:', currentPayersConfig.map((p: any) => p.ins_tpa_code));

          // Fallback: try matching by receiver_payer_id if payer_id is numeric
          if (data.patient_info?.payer_id) {
            const payerIdNum = parseInt(data.patient_info.payer_id, 10);
            if (!isNaN(payerIdNum)) {
              const matchingPayerById = currentPayersConfig.find((p: any) =>
                p.reciever_payer_id === payerIdNum || String(p.reciever_payer_id) === data.patient_info.payer_id
              );
              if (matchingPayerById) {
                console.log('✅ Auto-filled payer (fallback by ID):', matchingPayerById.ins_tpa_name, 'from payer_id:', data.patient_info.payer_id);
                setSelectedPayer(matchingPayerById);
              }
            }
          }
        }
      } else {
        console.log('⚠️ Could not extract payer code from Mantys response:', {
          payer_id: data.payer_id,
          patient_info_payer_id: data.patient_info?.payer_id,
          payer_name: data.policy_network?.payer_name
        });
      }
    } else {
      console.log('⚠️ PayersConfig is empty, cannot match payer');
    }

    setShowSavePolicyModal(true);
  };

  const handleConfirmSavePolicy = async () => {
    const finalPatientId = enrichedPatientId || patientId;
    const finalAppointmentId = enrichedAppointmentId || appointmentId;
    const finalEncounterId = enrichedEncounterId || encounterId;

    if (!finalPatientId || !finalAppointmentId) {
      alert(
        "Missing required patient information (Patient ID or Appointment ID). Cannot save policy details.",
      );
      return;
    }

    setSavingPolicy(true);
    setShowSavePolicyModal(false);

    try {
      // Get config values with fallbacks to defaults
      const siteId = tpaConfig?.lt_site_id ? parseInt(tpaConfig.lt_site_id, 10) : 31;
      const customerId = tpaConfig?.lt_customer_id ? parseInt(tpaConfig.lt_customer_id, 10) : 1;
      // Try to parse user.id as number, fallback to default if invalid
      const parsedUserId = user?.id ? parseInt(user.id, 10) : NaN;
      const createdBy = !isNaN(parsedUserId) ? parsedUserId : 13295;
      const ltOtherConfig = tpaConfig?.lt_other_config || {};

      // Get insurance mapping ID from config (preferred) or Mantys response
      const insuranceMappingId = tpaConfig?.hospital_insurance_mapping_id
        ? tpaConfig.hospital_insurance_mapping_id
        : (data.patient_info?.insurance_mapping_id ? parseInt(data.patient_info.insurance_mapping_id, 10) : null);

      // Use selected plan or try to find matching plan
      let planCodeFromConfig: string | null = null;
      let planIdFromConfig: number | null = null;
      if (selectedPlan) {
        planCodeFromConfig = selectedPlan.plan_code || null;
        planIdFromConfig = selectedPlan.plan_id || null;
      } else {
        // Fallback: try to find matching plan by name
        const planNameFromMantys = data.patient_info?.plan_name;
        if (planNameFromMantys && plansConfig.length > 0) {
          const matchingPlan = plansConfig.find((plan: any) => {
            const planName = plan.insurance_plan_name?.toLowerCase() || "";
            const mantysPlanName = planNameFromMantys.toLowerCase();
            return planName === mantysPlanName || planName.includes(mantysPlanName) || mantysPlanName.includes(planName);
          });
          if (matchingPlan) {
            planCodeFromConfig = matchingPlan.plan_code || null;
            planIdFromConfig = matchingPlan.plan_id || null;
          }
        }
      }

      // Get numeric network ID from config by matching network name/code
      let networkIdToUse: number | null = null;
      if (selectedNetwork) {
        // First, try to find in Aster networks config by matching network name or code
        const matchingAsterNetwork = asterNetworksConfig.find((n: any) => {
          const networkName = (n.network_name || '').toLowerCase().trim();
          const networkCode = (n.network_code || '').toLowerCase().trim();
          const selectedNetworkLower = selectedNetwork.toLowerCase().trim();
          return networkName === selectedNetworkLower ||
            networkCode === selectedNetworkLower ||
            networkName.includes(selectedNetworkLower) ||
            selectedNetworkLower.includes(networkName);
        });

        if (matchingAsterNetwork && matchingAsterNetwork.network_id) {
          // Convert to number if it's a string
          networkIdToUse = typeof matchingAsterNetwork.network_id === 'string'
            ? parseInt(matchingAsterNetwork.network_id, 10)
            : matchingAsterNetwork.network_id;
          console.log('✅ Found network ID from config:', networkIdToUse, 'for network:', selectedNetwork);
        } else {
          // Fallback: try to find network ID from Mantys response
          const networkFromMantys = data.policy_network?.all_networks?.find(
            (n: any) => n.network_value === selectedNetwork || n.network === selectedNetwork
          );
          if (networkFromMantys && (networkFromMantys as any).network_id) {
            networkIdToUse = typeof (networkFromMantys as any).network_id === 'string'
              ? parseInt((networkFromMantys as any).network_id, 10)
              : (networkFromMantys as any).network_id;
          } else if (data.policy_network && (data.policy_network as any).network_id) {
            networkIdToUse = typeof (data.policy_network as any).network_id === 'string'
              ? parseInt((data.policy_network as any).network_id, 10)
              : (data.policy_network as any).network_id;
          }
          if (networkIdToUse) {
            console.log('✅ Found network ID from Mantys response:', networkIdToUse);
          } else {
            console.warn('⚠️ Could not find numeric network ID for:', selectedNetwork);
          }
        }
      } else if (data.policy_network && (data.policy_network as any).network_id) {
        networkIdToUse = typeof (data.policy_network as any).network_id === 'string'
          ? parseInt((data.policy_network as any).network_id, 10)
          : (data.policy_network as any).network_id;
      }

      // Get payerId from selectedPayer (receiver_payer_id) or fallback
      const payerIdToUse = selectedPayer?.reciever_payer_id
        ? (typeof selectedPayer.reciever_payer_id === 'string'
          ? parseInt(selectedPayer.reciever_payer_id, 10)
          : selectedPayer.reciever_payer_id)
        : (data.patient_info?.payer_id
          ? (typeof data.patient_info.payer_id === 'string'
            ? parseInt(data.patient_info.payer_id, 10)
            : data.patient_info.payer_id)
          : null);

      if (selectedPayer && payerIdToUse) {
        console.log('✅ Using payer ID from selected payer:', payerIdToUse, 'payer:', selectedPayer.ins_tpa_name);
      } else if (!payerIdToUse) {
        console.warn('⚠️ No payer ID available - selectedPayer:', selectedPayer, 'data.patient_info.payer_id:', data.patient_info?.payer_id);
      }

      // Extract policy data from Mantys response, using config values
      const policyData = {
        policyId: data.patient_info?.policy_id || null,
        isActive: 1,
        payerId: payerIdToUse,
        insuranceCompanyId: null,
        networkId: networkIdToUse,
        siteId: siteId, // From config or default
        policyNumber: data.patient_info?.patient_id_info?.policy_number || null,
        insuranceGroupPolicyId: null,
        encounterid: finalEncounterId || null,
        parentInsPolicyId: null,
        tpaCompanyId: data.patient_info?.tpa_id || null,
        planName: selectedPlan?.insurance_plan_name || data.patient_info?.plan_name || null,
        planCode: planCodeFromConfig, // From config mapping
        planId: planIdFromConfig, // From config
        eligibilityReqId: null,
        tpaPolicyId: data.patient_info?.patient_id_info?.member_id || null,
        insRules: null,
        orgId: null,
        insuranceMappingId: insuranceMappingId, // From config (preferred) or Mantys response
        tpaGroupPolicyId: null,
        apntId: finalAppointmentId,
        insuranceValidTill: data.policy_end_date || null,
        orgName: null,
        tpaValidTill: data.policy_end_date || null,
        patientId: finalPatientId,
        insuranceRenewal: null,
        payerType: ltOtherConfig.payerType || 1, // From config or default
        insuranceStartDate: data.policy_start_date || null,
        insurancePolicyId: null,
        hasTopUpCard: 0,
        proposerRelation: "Self",
        createdBy: createdBy, // From user context or default
        empId: null,
        requestLetter: null,
        insertType: ltOtherConfig.insertType || 2, // From config or default
        customerId: customerId, // From config or default
        type: ltOtherConfig.type || 1, // From config or default
        relationshipId: ltOtherConfig.relationshipId || 26, // From config or default (26 = "Self")
        priorityPatientApplicable: 0,
        typeId: ltOtherConfig.typeId || 2, // From config or default
        DepData: null,
      };

      console.log("Saving policy data:", policyData);

      const response = await fetch("/api/aster/save-policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          policyData,
          patientId: finalPatientId,
          appointmentId: finalAppointmentId,
          encounterId: finalEncounterId,
          payerId: data.patient_info?.payer_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setPolicySaved(true);
        alert("Policy details saved successfully!");
        console.log("Policy saved:", result);
      } else {
        console.error("Failed to save policy:", result);
        alert(
          `Failed to save policy details: ${result.error || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Error saving policy:", error);
      alert("An error occurred while saving policy details. See console for details.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleUploadScreenshots = async () => {
    if (
      !keyFields.referralDocuments ||
      keyFields.referralDocuments.length === 0
    ) {
      alert("No referral documents to upload");
      return;
    }

    // Use enriched IDs (from props or Redis) or show error if not available
    // Note: encounterId defaults to 0 if not provided (standard in Aster API)
    const finalPatientId = enrichedPatientId || patientId;
    const finalAppointmentId = enrichedAppointmentId || appointmentId;
    const finalEncounterId = enrichedEncounterId || encounterId;

    if (!finalPatientId || !finalAppointmentId) {
      alert(
        "Missing required patient information (Patient ID or Appointment ID). Please ensure these are available before uploading.",
      );
      setUploadingFiles(false);
      return;
    }

    // Use fetched insTpaPatId or null
    const insTpaPatIdForUpload = insTpaPatId || null;
    console.log("📤 Using insTpaPatId for upload:", {
      fetched: insTpaPatId,
      using: insTpaPatIdForUpload,
    });

    setUploadingFiles(true);
    const newUploadProgress: { [key: string]: number } = {};
    const newUploadedFiles: string[] = [];

    try {
      // Upload each referral document
      for (let i = 0; i < keyFields.referralDocuments.length; i++) {
        const doc = keyFields.referralDocuments[i];
        const progressKey = `${doc.tag}_${i}`;

        newUploadProgress[progressKey] = 0;
        setUploadProgress({ ...newUploadProgress });

        console.log(`Uploading ${doc.tag}...`);

        const uploadRequest = {
          patientId: finalPatientId,
          encounterId: finalEncounterId || 0, // Default to 0 if not provided
          appointmentId: finalAppointmentId,
          insTpaPatId: insTpaPatIdForUpload,
          fileName: `${doc.tag.replace(/\s+/g, "_")}.pdf`,
          fileUrl: doc.s3_url,
        };

        const response = await fetch("/api/aster/upload-attachment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(uploadRequest),
        });

        const result = await response.json();

        if (response.ok) {
          newUploadProgress[progressKey] = 100;
          newUploadedFiles.push(doc.tag);
          console.log(`✅ Uploaded ${doc.tag} successfully`);
        } else {
          console.error(`❌ Failed to upload ${doc.tag}:`, result.error);
          newUploadProgress[progressKey] = -1; // Mark as failed
        }

        setUploadProgress({ ...newUploadProgress });
      }

      setUploadedFiles(newUploadedFiles);

      console.log("📊 Upload summary:", {
        uploadedFilesCount: newUploadedFiles.length,
        totalDocumentsCount: keyFields.referralDocuments.length,
        uploadedFiles: newUploadedFiles,
        allDocuments: keyFields.referralDocuments.map(d => d.tag),
      });

      // If all files uploaded successfully, save the eligibility order details
      if (newUploadedFiles.length === keyFields.referralDocuments.length) {
        console.log("✅ All files uploaded. Now saving eligibility order details...");
        console.log("📋 Debug info:", {
          tpaConfig: tpaConfig ? {
            ins_code: tpaConfig.ins_code,
            hospital_insurance_mapping_id: tpaConfig.hospital_insurance_mapping_id,
          } : null,
          patient_info_insurance_mapping_id: data.patient_info?.insurance_mapping_id,
          response_tpa: response.tpa,
          selectedClinicId,
        });

        try {
          // If tpaConfig is not loaded, try to load it now
          let currentTpaConfig = tpaConfig;
          if (!currentTpaConfig && selectedClinicId && response.tpa) {
            console.log("⚠️ TPA config not loaded, attempting to load now...");
            try {
              const configResponse = await fetch(`/api/clinic-config/tpa?clinic_id=${selectedClinicId}`);
              if (configResponse.ok) {
                const configData = await configResponse.json();
                if (configData.configs && Array.isArray(configData.configs)) {
                  currentTpaConfig = configData.configs.find(
                    (c: any) => c.ins_code === response.tpa || c.tpa_id === response.tpa || c.payer_code === response.tpa
                  );
                  if (currentTpaConfig) {
                    console.log("✅ Loaded TPA config on-demand:", {
                      ins_code: currentTpaConfig.ins_code,
                      hospital_insurance_mapping_id: currentTpaConfig.hospital_insurance_mapping_id,
                    });
                  }
                }
              }
            } catch (loadError) {
              console.error("❌ Failed to load TPA config on-demand:", loadError);
            }
          }

          // Get insurance mapping ID from config (preferred) or Mantys response
          const insuranceMappingId = currentTpaConfig?.hospital_insurance_mapping_id
            ? currentTpaConfig.hospital_insurance_mapping_id
            : (data.patient_info?.insurance_mapping_id ? parseInt(data.patient_info.insurance_mapping_id, 10) : null);

          console.log("🔍 Insurance Mapping ID lookup:", {
            fromTpaConfig: currentTpaConfig?.hospital_insurance_mapping_id,
            fromPatientInfo: data.patient_info?.insurance_mapping_id,
            finalValue: insuranceMappingId,
          });

          if (!insuranceMappingId) {
            console.warn("⚠️ No insurance mapping ID found. Skipping eligibility order save.");
            console.warn("💡 To fix this, ensure TPA config has hospital_insurance_mapping_id set for TPA:", response.tpa);
            alert(
              `All ${newUploadedFiles.length} documents uploaded successfully!\n\nNote: Could not save eligibility order details (missing insurance mapping ID).\n\nPlease check TPA configuration for: ${response.tpa || 'Unknown TPA'}`,
            );
            return;
          }

          // Use insTpaPatId for insuranceMappingId in ordObj (not hospital_insurance_mapping_id)
          // But we still need hospital_insurance_mapping_id for the main body
          const insTpaPatIdForOrder = insTpaPatId || null; // Use fetched insTpaPatId or null
          const physicianIdForOrder = enrichedPhysicianId || null; // Use fetched physicianId or null

          console.log("🔍 Using values for save order:", {
            insTpaPatId: insTpaPatIdForOrder,
            physicianId: physicianIdForOrder,
            fetchedInsTpaPatId: insTpaPatId,
            fetchedPhysicianId: enrichedPhysicianId,
          });

          // Call the save eligibility order API
          console.log("📤 Calling save-eligibility-order API with:", {
            patientId: finalPatientId,
            appointmentId: finalAppointmentId,
            encounterId: finalEncounterId,
            insuranceMappingId, // hospital_insurance_mapping_id for main body
            insTpaPatId: insTpaPatIdForOrder, // insTpaPatId for ordObj
            physicianId: physicianIdForOrder,
            vendorId: 24,
            siteId: 31,
          });

          const orderResponse = await fetch("/api/aster/save-eligibility-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              patientId: finalPatientId,
              appointmentId: finalAppointmentId,
              encounterId: finalEncounterId,
              insuranceMappingId, // hospital_insurance_mapping_id for main body
              insTpaPatId: insTpaPatIdForOrder, // insTpaPatId for ordObj.insuranceMappingId
              physicianId: physicianIdForOrder,
              authorizationNumber: "",
              authorizationName: "",
              createdBy: 13295, // Default user ID
              vendorId: 24,
              siteId: 31,
            }),
          });

          console.log("📥 Save order API response status:", orderResponse.status);

          const orderResult = await orderResponse.json();
          console.log("📥 Save order API response data:", orderResult);

          if (orderResponse.ok) {
            console.log("✅ Eligibility order saved successfully:", orderResult);

            // Extract reqid from response - check both possible response structures
            const reqId = orderResult?.data?.body?.Data?.[0]?.reqid ||
              orderResult?.body?.Data?.[0]?.reqid ||
              null;

            const statusText = orderResult?.data?.body?.Data?.[0]?.status_text ||
              orderResult?.body?.Data?.[0]?.status_text ||
              "Eligibility Details Captured Successfully";

            const successMessage = reqId
              ? `✅ SUCCESS!\n\nAll ${newUploadedFiles.length} documents uploaded successfully!\n\nEligibility order saved to Aster.\n\n📋 Request ID: ${reqId}\n📝 Status: ${statusText}\n\nYou can view this order in Aster's eligibility system.`
              : `✅ SUCCESS!\n\nAll ${newUploadedFiles.length} documents uploaded successfully!\n\nEligibility order details saved to Aster.\n\nStatus: ${statusText}`;

            console.log("📋 Order saved with details:", {
              reqId,
              statusText,
              patientId: finalPatientId,
              appointmentId: finalAppointmentId,
              insuranceMappingId,
              fullResponse: orderResult,
            });

            alert(successMessage);

            // Trigger a custom event to notify other components (like eligibility history)
            // The order is saved in Aster, so it should be visible in Aster's UI
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('eligibilityOrderSaved', {
                detail: {
                  reqId,
                  patientId: finalPatientId,
                  appointmentId: finalAppointmentId,
                  insuranceMappingId,
                  statusText,
                }
              }));
              console.log("📢 Dispatched eligibilityOrderSaved event with reqId:", reqId);
            }
          } else {
            console.error("❌ Failed to save eligibility order:", {
              status: orderResponse.status,
              error: orderResult.error,
              details: orderResult.details,
              fullResponse: orderResult,
            });
            const errorMessage = orderResult.error || orderResult.message || "Unknown error";
            const errorDetails = orderResult.details ? `\n\nDetails: ${JSON.stringify(orderResult.details)}` : "";
            alert(
              `All ${newUploadedFiles.length} documents uploaded successfully!\n\nWarning: Failed to save eligibility order details.\n\nError: ${errorMessage}${errorDetails}\n\nPlease check the browser console for more details.`,
            );
          }
        } catch (orderError) {
          console.error("❌ Error saving eligibility order:", orderError);
          alert(
            `All ${newUploadedFiles.length} documents uploaded successfully!\n\nWarning: Error occurred while saving eligibility order details. See console for details.`,
          );
        }
      } else {
        alert(
          `Uploaded ${newUploadedFiles.length} out of ${keyFields.referralDocuments.length} documents. Check console for errors.`,
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload documents. See console for details.");
    } finally {
      setUploadingFiles(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Eligibility Status Header */}
      <div
        className={`rounded-lg p-6 ${keyFields.isEligible
          ? "bg-green-50 border border-green-200"
          : "bg-red-50 border border-red-200"
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${keyFields.isEligible ? "bg-green-500" : "bg-red-500"
                }`}
            >
              {keyFields.isEligible ? (
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div>
              <h2
                className={`text-2xl font-bold ${keyFields.isEligible ? "text-green-900" : "text-red-900"}`}
              >
                {keyFields.isEligible
                  ? "Patient is Eligible"
                  : "Patient is Not Eligible"}
              </h2>
              <p
                className={`text-sm ${keyFields.isEligible ? "text-green-700" : "text-red-700"}`}
              >
                Status: {response.status}
              </p>
            </div>
          </div>
          <Badge
            className={
              keyFields.isEligible
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-red-100 text-red-800 border-red-300"
            }
          >
            {data.policy_network?.policy_authority || "N/A"}
          </Badge>
        </div>
      </div>

      {/* Screenshot Section */}
      {screenshot && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            TPA Portal Screenshot
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <img
              src={screenshot}
              alt="TPA Portal Screenshot"
              className="w-full h-auto"
              onError={(e) => {
                console.error("Failed to load screenshot");
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            Screenshot captured during eligibility verification process
          </p>
        </Card>
      )}

      {/* Referral Documents */}
      {keyFields.referralDocuments &&
        keyFields.referralDocuments.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Referral Documents
              </h3>
              <Button
                onClick={handleUploadScreenshots}
                disabled={uploadingFiles}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploadingFiles ? (
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
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2 inline"
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
                    Upload Screenshots
                  </>
                )}
              </Button>
            </div>
            <div className="space-y-2">
              {keyFields.referralDocuments.map((doc, idx) => {
                const progressKey = `${doc.tag}_${idx}`;
                const progress = uploadProgress[progressKey];
                const isUploaded = uploadedFiles.includes(doc.tag);

                return (
                  <div key={idx} className="relative">
                    <a
                      href={doc.s3_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 border rounded-lg transition ${isUploaded
                        ? "bg-green-50 border-green-300"
                        : progress === -1
                          ? "bg-red-50 border-red-300"
                          : "bg-blue-50 hover:bg-blue-100 border-blue-200"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 ${isUploaded
                          ? "text-green-600"
                          : progress === -1
                            ? "text-red-600"
                            : "text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {isUploaded ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        ) : progress === -1 ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
                          />
                        )}
                      </svg>
                      <div className="flex-1">
                        <div
                          className={`font-medium ${isUploaded
                            ? "text-green-900"
                            : progress === -1
                              ? "text-red-900"
                              : "text-blue-900"
                            }`}
                        >
                          {doc.tag}
                        </div>
                        {doc.id && (
                          <div
                            className={`text-xs ${isUploaded
                              ? "text-green-700"
                              : progress === -1
                                ? "text-red-700"
                                : "text-blue-700"
                              }`}
                          >
                            ID: {doc.id}
                          </div>
                        )}
                        {isUploaded && (
                          <div className="text-xs text-green-700 font-medium mt-1">
                            ✓ Uploaded to Aster
                          </div>
                        )}
                        {progress === -1 && (
                          <div className="text-xs text-red-700 font-medium mt-1">
                            ✗ Upload failed
                          </div>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 ${isUploaded
                          ? "text-green-600"
                          : progress === -1
                            ? "text-red-600"
                            : "text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                    {progress !== undefined &&
                      progress >= 0 &&
                      progress < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      {/* Patient Information */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Patient Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {patientMPI && (
            <div>
              <span className="font-medium text-gray-700">MPI:</span>
              <p className="text-gray-900 mt-1 font-mono">{patientMPI}</p>
            </div>
          )}
          {(enrichedPatientId || patientId) && (
            <div>
              <span className="font-medium text-gray-700">Patient ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{enrichedPatientId || patientId}</p>
            </div>
          )}
          {(enrichedAppointmentId || appointmentId) && (
            <div>
              <span className="font-medium text-gray-700">Appointment ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{enrichedAppointmentId || appointmentId}</p>
            </div>
          )}
          {encounterId && (
            <div>
              <span className="font-medium text-gray-700">Encounter ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{encounterId}</p>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Policy Holder:</span>
            <p className="text-gray-900 mt-1">{data.policy_holder_name}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date of Birth:</span>
            <p className="text-gray-900 mt-1">{data.policy_holder_dob}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Gender:</span>
            <p className="text-gray-900 mt-1">
              {data.patient_info?.policy_holder_gender || "N/A"}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Member ID:</span>
            <p className="text-gray-900 mt-1 font-mono">{keyFields.memberId}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Emirates ID:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.policy_holder_emirates_id}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">DHA Member ID:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.patient_info?.policy_primary_dha_member_id || "N/A"}
            </p>
          </div>
        </div>
      </Card>

      {/* Policy Information */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Policy Details
          </h3>
          <Button
            onClick={handleSavePolicy}
            disabled={savingPolicy || policySaved}
            className={
              policySaved
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }
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
            ) : policySaved ? (
              <>
                <svg
                  className="w-4 h-4 mr-2 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Policy Saved
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save Policy
              </>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Payer Name:</span>
            <p className="text-gray-900 mt-1">{keyFields.payerName}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy Authority:</span>
            <p className="text-gray-900 mt-1">
              {data.policy_network?.policy_authority || "N/A"}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">
              Policy Start Date:
            </span>
            <p className="text-gray-900 mt-1">{keyFields.policyStartDate}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy End Date:</span>
            <p className="text-gray-900 mt-1">{keyFields.policyEndDate}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">
              Network (Card Type):
            </span>
            <p className="text-gray-900 mt-1">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {keyFields.network || "N/A"}
              </Badge>
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy Number:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.patient_info?.patient_id_info?.policy_number || "N/A"}
            </p>
          </div>
        </div>

        {/* All Networks */}
        {data.policy_network?.all_networks &&
          data.policy_network.all_networks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="font-medium text-gray-700 block mb-2">
                Available Networks:
              </span>
              <div className="flex flex-wrap gap-2">
                {data.policy_network.all_networks.map((network, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2"
                  >
                    <div className="font-semibold text-blue-900">
                      {network.network_value}
                    </div>
                    <div className="text-blue-700">{network.visit_type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </Card>

      {/* Copay Details */}
      {keyFields.copayDetails && keyFields.copayDetails.length > 0 && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Copay & Deductible Details
          </h3>
          <div className="space-y-3">
            {keyFields.copayDetails.map((copayCategory, idx) => {
              const isExpanded = expandedCopay === copayCategory.name;
              return (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCopayExpanded(copayCategory.name)}
                    className="w-full bg-gray-50 hover:bg-gray-100 p-4 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          copayCategory.name === "Outpatient"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : copayCategory.name === "Inpatient"
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : copayCategory.name === "Maternity"
                                ? "bg-pink-100 text-pink-800 border-pink-200"
                                : "bg-purple-100 text-purple-800 border-purple-200"
                        }
                      >
                        {copayCategory.name}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Primary Network:{" "}
                        <span className="font-medium text-gray-900">
                          {copayCategory.primary_network.network}
                        </span>
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 font-semibold text-gray-700">
                              Service Type
                            </th>
                            <th className="text-right py-2 font-semibold text-gray-700">
                              Copay (%)
                            </th>
                            <th className="text-right py-2 font-semibold text-gray-700">
                              Deductible (AED)
                            </th>
                            <th className="text-center py-2 font-semibold text-gray-700">
                              Set Copay
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(copayCategory.values_to_fill).map(
                            ([serviceType, values]) => (
                              <tr
                                key={serviceType}
                                className="border-b border-gray-100"
                              >
                                <td className="py-2 text-gray-900">
                                  {serviceType}
                                </td>
                                <td className="text-right py-2 text-gray-900 font-medium">
                                  {values.copay}%
                                </td>
                                <td className="text-right py-2 text-gray-900 font-medium">
                                  {values.deductible}
                                </td>
                                <td className="text-center py-2">
                                  {values.should_set_copay ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Special Remarks */}
      {keyFields.specialRemarks && keyFields.specialRemarks.length > 0 && (
        <Card className="p-5 bg-orange-50 border-orange-200">
          <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center gap-2">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Important Remarks & Requirements
          </h3>
          <ul className="space-y-2 text-sm text-orange-900">
            {keyFields.specialRemarks.map((remark, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>{remark}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Raw JSON Toggle */}
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            View Raw JSON Response
          </h3>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showRawJson ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showRawJson && (
          <pre className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg overflow-auto text-xs max-h-96">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white pb-4 border-t border-gray-200 pt-4">
        <div className="flex gap-3">
          {onCheckAnother && (
            <Button
              onClick={onCheckAnother}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Check Another Eligibility
            </Button>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose} className="px-6">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Lifetrenz Data Preview Sidebar */}
      <Sidebar
        isOpen={showLifetrenzPreview}
        onClose={handleCloseLifetrenzPreview}
        title="Send Data to Lifetrenz"
        width="700px"
      >
        <LifetrenzEligibilityPreview
          response={response}
          onClose={handleCloseLifetrenzPreview}
        />
      </Sidebar>

      {/* Save Policy Preview Modal */}
      <Modal
        isOpen={showSavePolicyModal}
        onClose={() => setShowSavePolicyModal(false)}
        title="Insurance Detail - Save Policy"
      >
        <div className="flex flex-col min-h-full">
          {/* Scrollable Content */}
          <div className="flex-1 p-6 space-y-6">
            {/* Insurance Policy Information Section */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Insurance Policy Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Insurance Card # (Member ID) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Insurance Card # (Member ID) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Enter member ID"
                  />
                </div>

                {/* Receiver ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Receiver ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                    placeholder="Enter receiver ID"
                  />
                </div>

                {/* Payer */}
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
                      const payer = payersConfig.find((p: any) => p.reciever_payer_id === selected?.value);
                      setSelectedPayer(payer || null);
                    }}
                    options={payersConfig.map((payer: any) => ({
                      value: payer.reciever_payer_id,
                      label: payer.ins_tpa_name,
                    }))}
                    placeholder="Select payer"
                    isSearchable
                  />
                </div>

                {/* Plan */}
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
                      const plan = plansConfig.find((p: any) => p.plan_id === selected?.value);
                      setSelectedPlan(plan || null);
                      if (plan) setRateCard(plan.plan_code || "");
                    }}
                    options={(() => {
                      // If we have a selected network (from Mantys response), filter plans by mappings
                      // Otherwise show all plans
                      if (selectedNetwork && planMappings.length > 0) {
                        const mappedPlanIds = planMappings
                          .filter((m: any) => m.mantys_network_name === selectedNetwork)
                          .map((m: any) => m.lt_plan_id);
                        if (mappedPlanIds.length > 0) {
                          return plansConfig
                            .filter((plan: any) => mappedPlanIds.includes(plan.plan_id))
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
                  />
                </div>

                {/* Rate Card */}
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

                {/* Expiry Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expiry Date (DD/MM/YYYY) <span className="text-red-600">*</span>
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

            {/* Patient Payable Section */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Payable</h3>

              {/* Deductible */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Deductible</label>
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
                      <label className="block text-xs text-gray-600 mb-1">Flat *</label>
                      <input
                        type="number"
                        value={deductibleFlat}
                        onChange={(e) => setDeductibleFlat(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Max</label>
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

              {/* CoPay */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">CoPay</label>
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

              {/* Charge Group Table */}
              {hasCopay && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Charge Group</label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Charge Group</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Flat</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">%</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Max</th>
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
                            <td colSpan={4} className="py-4 px-3 text-center text-gray-500 text-sm">
                              No charge groups configured. Copay details will be populated from Mantys response.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Insurance Holder Details Summary */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Primary Insurance Holder Details</h3>
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Card #</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Receiver</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Payer</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Plan</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Expiry Date</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Status</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Relation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-3">{memberId || "-"}</td>
                      <td className="py-2 px-3">{receiverId || "-"}</td>
                      <td className="py-2 px-3">{selectedPayer?.ins_tpa_name || "-"}</td>
                      <td className="py-2 px-3">{selectedPlan ? `${selectedPlan.plan_id} - ${selectedPlan.insurance_plan_name}` : "-"}</td>
                      <td className="py-2 px-3">{expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : "-"}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>
                      </td>
                      <td className="py-2 px-3">Self</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Buttons - Sticky Footer */}
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
              ) : (
                "Update Insurance Details"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
