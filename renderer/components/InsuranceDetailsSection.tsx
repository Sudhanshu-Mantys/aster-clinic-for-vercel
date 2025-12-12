import React, { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { InsuranceData, PatientData } from "../lib/api";
import { MantysEligibilityForm } from "./MantysEligibilityForm";
import { Button } from "./ui/button";
import { Sidebar } from "./ui/sidebar";
import { useAuth } from "../contexts/AuthContext";

interface InsuranceDetailsSectionProps {
  isLoadingInsurance: boolean;
  insuranceError: string | null;
  insuranceDetails: InsuranceData[];
  expandedInsurance: Set<number>;
  onToggleExpanded: (insuranceId: number) => void;
  patientData?: PatientData | null;
}

export const InsuranceDetailsSection: React.FC<
  InsuranceDetailsSectionProps
> = ({
  isLoadingInsurance,
  insuranceError,
  insuranceDetails,
  expandedInsurance,
  onToggleExpanded,
  patientData,
}) => {
    const { user } = useAuth();
    const [selectedInsuranceForEligibility, setSelectedInsuranceForEligibility] =
      useState<InsuranceData | null>(null);
    const [showEligibilitySidebar, setShowEligibilitySidebar] = useState(false);
    const [tpaConfigs, setTpaConfigs] = useState<Record<string, any>>({});
    const [doctors, setDoctors] = useState<any[]>([]);
    const [eligibilityButtonStates, setEligibilityButtonStates] = useState<Record<number, boolean>>({});

    const clinicId = user?.selected_team_id || "";

    // Load TPA configs and doctors
    useEffect(() => {
      if (clinicId) {
        loadTPAConfigs();
        loadDoctors();
      }
    }, [clinicId]);

    const loadTPAConfigs = async () => {
      if (!clinicId) return;
      try {
        const response = await fetch(`/api/clinic-config/tpa?clinic_id=${clinicId}`);
        if (response.ok) {
          const data = await response.json();
          const configsMap: Record<string, any> = {};
          if (data.configs && Array.isArray(data.configs)) {
            data.configs.forEach((config: any) => {
              // Map by ins_code and payer_code
              if (config.ins_code) {
                configsMap[config.ins_code] = config;
              }
              if (config.payer_code) {
                configsMap[config.payer_code] = config;
              }
            });
          }
          setTpaConfigs(configsMap);
        }
      } catch (error) {
        console.error("Failed to load TPA configs:", error);
      }
    };

    const loadDoctors = async () => {
      if (!clinicId) return;
      try {
        const response = await fetch(`/api/clinic-config/doctors?clinic_id=${clinicId}`);
        if (response.ok) {
          const data = await response.json();
          setDoctors(data.configs || []);
        }
      } catch (error) {
        console.error("Failed to load doctors:", error);
      }
    };

    // Check if doctor is compulsory and if DHA ID is available
    const checkEligibilityButtonVisibility = (insurance: InsuranceData): boolean => {
      if (insurance.insurance_status?.toLowerCase() !== "active") {
        return false;
      }

      // Find TPA config by payer_code or ins_code
      const payerCode = insurance.payer_code;
      const tpaConfig = payerCode ? tpaConfigs[payerCode] : null;

      if (!tpaConfig) {
        // If no config found, show button (default behavior)
        return true;
      }

      // Check if doctor is compulsory
      const extraFormFields = tpaConfig.extra_form_fields || [];
      const doctorField = extraFormFields.find((field: any) => field.field === "doctor");
      const isDoctorCompulsory = doctorField?.required === true;

      if (!isDoctorCompulsory) {
        // Doctor is not compulsory, show button
        return true;
      }

      // Doctor is compulsory, check if any doctor has DHA ID
      const hasDoctorWithDhaId = doctors.some((doctor) => doctor.dha_id && doctor.dha_id.trim() !== "");
      return hasDoctorWithDhaId;
    };

    // Update button states when configs or doctors change
    useEffect(() => {
      if (insuranceDetails.length > 0 && Object.keys(tpaConfigs).length > 0 && doctors.length >= 0) {
        const states: Record<number, boolean> = {};
        insuranceDetails.forEach((insurance, index) => {
          const key = insurance.patient_insurance_tpa_policy_id || index;
          states[key] = checkEligibilityButtonVisibility(insurance);
        });
        setEligibilityButtonStates(states);
      }
    }, [insuranceDetails, tpaConfigs, doctors]);

    const handleCheckEligibility = (insurance: InsuranceData) => {
      setSelectedInsuranceForEligibility(insurance);
      setShowEligibilitySidebar(true);
    };

    const handleSearchAcrossAllTPAs = () => {
      // Open eligibility form without specific insurance data
      // This will trigger the form to prefill with Emirates ID and BOTH option
      setSelectedInsuranceForEligibility(null);
      setShowEligibilitySidebar(true);
    };

    const handleCloseSidebar = () => {
      setShowEligibilitySidebar(false);
      // Delay clearing the selected insurance to allow sidebar animation to complete
      setTimeout(() => setSelectedInsuranceForEligibility(null), 300);
    };

    return (
      <div className="ml-8 mt-4 pt-4 border-t border-green-200">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">
          Insurance Details
        </h5>

        {isLoadingInsurance && (
          <div className="flex items-center text-sm text-gray-600">
            <svg
              className="animate-spin h-4 w-4 mr-2"
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
            Loading insurance details...
          </div>
        )}

        {insuranceError && (
          <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-200">
            <p className="font-medium">Unable to fetch insurance details</p>
            <p className="text-xs mt-1">{insuranceError}</p>
          </div>
        )}

        {!isLoadingInsurance &&
          !insuranceError &&
          insuranceDetails.length === 0 && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-3">
                No insurance records found for this patient
              </p>
              <Button
                onClick={handleSearchAcrossAllTPAs}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                🔍 Search Across All TPAs with Mantys
              </Button>
            </div>
          )}

        {!isLoadingInsurance && insuranceDetails.length > 0 && (
          <div className="space-y-3">
            {insuranceDetails.map((insurance, index) => {
              const isExpanded = expandedInsurance.has(
                insurance.patient_insurance_tpa_policy_id,
              );
              const isExpired =
                insurance.insurance_status?.toLowerCase() === "expired";

              return (
                <div
                  key={insurance.patient_insurance_tpa_policy_id || index}
                  className={`border rounded-lg p-4 transition-all ${isExpired
                    ? "bg-gray-50 border-gray-200"
                    : "bg-blue-50 border-blue-200"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onToggleExpanded(insurance.patient_insurance_tpa_policy_id)
                    }
                    className="w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h6
                            className={`font-medium ${isExpired ? "text-gray-700" : "text-blue-900"}`}
                          >
                            {insurance.tpa_name ||
                              insurance.payer_name ||
                              `Insurance ${index + 1}`}
                          </h6>
                          {insurance.ins_plan && (
                            <span
                              className={`text-xs ${isExpired ? "text-gray-600" : "text-blue-700"}`}
                            >
                              ({insurance.ins_plan})
                            </span>
                          )}
                        </div>
                        {!isExpanded && insurance.ins_exp_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expires: {insurance.ins_exp_date}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end gap-1">
                          {insurance.insurance_status && (
                            <Badge
                              className={`${insurance.insurance_status.toLowerCase() ===
                                "active"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : insurance.insurance_status.toLowerCase() ===
                                  "expired"
                                  ? "bg-red-100 text-red-800 border-red-200"
                                  : "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                            >
                              {insurance.insurance_status}
                            </Badge>
                          )}
                          {insurance.is_valid === 1 && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              Valid
                            </Badge>
                          )}
                        </div>
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""} ${isExpired ? "text-gray-500" : "text-blue-600"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 text-sm">
                      {insurance.tpa_policy_id && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            TPA Policy ID:
                          </span>
                          <span className="text-gray-900 flex-1">
                            {insurance.tpa_policy_id}
                          </span>
                        </div>
                      )}
                      {insurance.payer_name && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            Payer:
                          </span>
                          <span className="text-gray-900 flex-1">
                            {insurance.payer_name}
                          </span>
                        </div>
                      )}
                      {insurance.payer_code && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            Payer Code:
                          </span>
                          <span className="text-gray-900 flex-1">
                            {insurance.payer_code}
                          </span>
                        </div>
                      )}
                      {insurance.relation && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            Relation:
                          </span>
                          <span className="text-gray-900 flex-1">
                            {insurance.relation}
                          </span>
                        </div>
                      )}
                      {insurance.rate_card_name && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            Rate Card:
                          </span>
                          <span className="text-gray-900 flex-1">
                            {insurance.rate_card_name}
                          </span>
                        </div>
                      )}
                      {insurance.authorization_limit && (
                        <div className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[140px]">
                            Auth Limit:
                          </span>
                          <span className="text-gray-900 flex-1">
                            AED {insurance.authorization_limit}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200">
                        {insurance.insurance_from && (
                          <div>
                            <span className="font-medium text-gray-700 block">
                              From:
                            </span>
                            <span className="text-gray-900">
                              {insurance.insurance_from}
                            </span>
                          </div>
                        )}
                        {insurance.ins_exp_date && (
                          <div>
                            <span className="font-medium text-gray-700 block">
                              Expires:
                            </span>
                            <span className="text-gray-900">
                              {insurance.ins_exp_date}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Copay/Deductible Details */}
                      {insurance.copay?.Default && (
                        <div className="pt-2 border-t border-blue-200">
                          <span className="font-medium text-gray-700 block mb-2">
                            Coverage Details:
                          </span>
                          <div className="space-y-1 text-xs">
                            {insurance.copay.Default.copay_details &&
                              insurance.copay.Default.copay_details.length >
                              0 && (
                                <div className="bg-white rounded p-2">
                                  <p className="font-medium text-gray-800 mb-1">
                                    Copay:
                                  </p>
                                  {insurance.copay.Default.copay_details.map(
                                    (copay, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between text-gray-700"
                                      >
                                        <span>{copay.chargeGroupName}:</span>
                                        <span>
                                          {copay.payableAmount}%{" "}
                                          {copay.payableAmountDesc}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            {insurance.copay.Default.Deduct_details &&
                              insurance.copay.Default.Deduct_details.length >
                              0 && (
                                <div className="bg-white rounded p-2">
                                  <p className="font-medium text-gray-800 mb-1">
                                    Deductible:
                                  </p>
                                  {insurance.copay.Default.Deduct_details.map(
                                    (deduct, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between text-gray-700"
                                      >
                                        <span>
                                          {deduct.chargeGroupName || "General"}:
                                        </span>
                                        <span>
                                          {deduct.payableAmount}{" "}
                                          {deduct.payableAmountDesc}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Check Eligibility Button */}
                      {(() => {
                        const insuranceKey = insurance.patient_insurance_tpa_policy_id || index;
                        // Use pre-computed state if available, otherwise compute on the fly
                        let shouldShowButton = eligibilityButtonStates[insuranceKey];
                        if (shouldShowButton === undefined) {
                          shouldShowButton = checkEligibilityButtonVisibility(insurance);
                        }

                        if (insurance.insurance_status?.toLowerCase() === "active" && shouldShowButton) {
                          return (
                            <div className="pt-3 border-t border-blue-200 mt-3">
                              <Button
                                onClick={() => handleCheckEligibility(insurance)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                size="sm"
                              >
                                ✓ Check Eligibility with Mantys
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mantys Eligibility Form in Sidebar */}
        <Sidebar
          isOpen={showEligibilitySidebar}
          onClose={handleCloseSidebar}
          title={
            selectedInsuranceForEligibility
              ? "Mantys Insurance Eligibility Check"
              : "Search Across All TPAs"
          }
          width="700px"
        >
          <MantysEligibilityForm
            patientData={patientData}
            insuranceData={selectedInsuranceForEligibility}
            onClose={handleCloseSidebar}
          />
        </Sidebar>
      </div>
    );
  };
