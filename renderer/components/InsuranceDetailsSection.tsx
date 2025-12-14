import React, { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { InsuranceData, PatientData } from "../lib/api";
import { MantysEligibilityForm } from "./MantysEligibilityForm";
import { Button } from "./ui/button";
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
    const [showEligibilityFormFor, setShowEligibilityFormFor] = useState<Set<number>>(new Set());
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

    // Automatically open form for active insurance entries when they're expanded
    useEffect(() => {
      const newOpenForms = new Set(showEligibilityFormFor);
      let hasChanges = false;

      insuranceDetails.forEach((insurance, index) => {
        const insuranceKey = insurance.patient_insurance_tpa_policy_id || index;
        const isActive = insurance.insurance_status?.toLowerCase() === "active";
        const isExpanded = expandedInsurance.has(insuranceKey);

        // Check if button should be visible for this active insurance
        if (isActive && isExpanded) {
          // Check visibility directly using the function, or fall back to state
          const shouldShowButton = eligibilityButtonStates[insuranceKey] !== false
            ? (eligibilityButtonStates[insuranceKey] ?? checkEligibilityButtonVisibility(insurance))
            : false;

          if (shouldShowButton && !newOpenForms.has(insuranceKey)) {
            newOpenForms.add(insuranceKey);
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        setShowEligibilityFormFor(newOpenForms);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedInsurance, insuranceDetails, eligibilityButtonStates]);

    const handleCheckEligibility = (insurance: InsuranceData, insuranceKey: number) => {
      // Toggle form visibility - if already showing for this insurance, hide it
      const newOpenForms = new Set(showEligibilityFormFor);
      if (newOpenForms.has(insuranceKey)) {
        newOpenForms.delete(insuranceKey);
      } else {
        // Expand the accordion if it's not already expanded
        if (!expandedInsurance.has(insuranceKey)) {
          onToggleExpanded(insuranceKey);
        }
        newOpenForms.add(insuranceKey);
      }
      setShowEligibilityFormFor(newOpenForms);
    };

    const handleSearchAcrossAllTPAs = () => {
      // For "no insurance" case, we'll use a special key (-1) to show the form
      const newOpenForms = new Set(showEligibilityFormFor);
      if (newOpenForms.has(-1)) {
        newOpenForms.delete(-1);
      } else {
        newOpenForms.add(-1);
      }
      setShowEligibilityFormFor(newOpenForms);
    };

    const handleCloseForm = (insuranceKey?: number) => {
      if (insuranceKey !== undefined) {
        const newOpenForms = new Set(showEligibilityFormFor);
        newOpenForms.delete(insuranceKey);
        setShowEligibilityFormFor(newOpenForms);
      } else {
        setShowEligibilityFormFor(new Set());
      }
    };

    return (
      <div>
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          Insurance Details (Lifetrenz)
        </h3>

        {isLoadingInsurance && (
          <div className="flex items-center text-xs text-gray-600">
            <svg
              className="animate-spin h-3 w-3 mr-2"
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
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-200">
            <p className="font-medium">Unable to fetch insurance details</p>
            <p className="text-xs mt-0.5">{insuranceError}</p>
          </div>
        )}

        {!isLoadingInsurance &&
          !insuranceError &&
          insuranceDetails.length === 0 && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">
                No insurance records found for this patient
              </p>
              <Button
                onClick={handleSearchAcrossAllTPAs}
                className={`w-full text-xs py-1.5 ${showEligibilityFormFor.has(-1)
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                size="sm"
              >
                {showEligibilityFormFor.has(-1) ? "▼ Hide Eligibility Form" : "🔍 Search Across All TPAs with Mantys"}
              </Button>
              {showEligibilityFormFor.has(-1) && (
                <div className="mt-4">
                  <MantysEligibilityForm
                    patientData={patientData}
                    insuranceData={null}
                    onClose={() => handleCloseForm(-1)}
                  />
                </div>
              )}
            </div>
          )}

        {!isLoadingInsurance && insuranceDetails.length > 0 && (
          <div className="space-y-2">
            {insuranceDetails.map((insurance, index) => {
              const insuranceKey = insurance.patient_insurance_tpa_policy_id || index;
              const isExpanded = expandedInsurance.has(insuranceKey);
              const isExpired =
                insurance.insurance_status?.toLowerCase() === "expired";

              return (
                <div
                  key={insuranceKey}
                  className={`border rounded-lg p-3 transition-all ${isExpired
                    ? "bg-gray-50 border-gray-200"
                    : "bg-blue-50 border-blue-200"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onToggleExpanded(insuranceKey)
                    }
                    className="w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h6 className={`font-medium text-sm ${isExpired ? "text-gray-700" : "text-blue-900"}`}>
                            {insurance.tpa_name ||
                              insurance.payer_name ||
                              `Insurance ${index + 1}`}
                          </h6>
                          {insurance.ins_plan && (
                            <span className={`text-xs ${isExpired ? "text-gray-600" : "text-blue-700"}`}>
                              ({insurance.ins_plan})
                            </span>
                          )}
                        </div>
                        {!isExpanded && insurance.ins_exp_date && (
                          <p className="text-xs text-gray-500 mt-0.5">
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
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""} ${isExpired ? "text-gray-500" : "text-blue-600"}`}
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
                    <div className="mt-2 space-y-1.5 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        {insurance.tpa_policy_id && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              TPA Policy ID:
                            </span>
                            <span className="text-gray-900">
                              {insurance.tpa_policy_id}
                            </span>
                          </div>
                        )}
                        {insurance.payer_name && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              Payer:
                            </span>
                            <span className="text-gray-900">
                              {insurance.payer_name}
                            </span>
                          </div>
                        )}
                        {insurance.payer_code && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              Payer Code:
                            </span>
                            <span className="text-gray-900">
                              {insurance.payer_code}
                            </span>
                          </div>
                        )}
                        {insurance.relation && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              Relation:
                            </span>
                            <span className="text-gray-900">
                              {insurance.relation}
                            </span>
                          </div>
                        )}
                        {insurance.rate_card_name && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              Rate Card:
                            </span>
                            <span className="text-gray-900">
                              {insurance.rate_card_name}
                            </span>
                          </div>
                        )}
                        {insurance.authorization_limit && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              Auth Limit:
                            </span>
                            <span className="text-gray-900">
                              AED {insurance.authorization_limit}
                            </span>
                          </div>
                        )}
                        {insurance.insurance_from && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
                              From:
                            </span>
                            <span className="text-gray-900">
                              {insurance.insurance_from}
                            </span>
                          </div>
                        )}
                        {insurance.ins_exp_date && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700">
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
                        <div className={`pt-1.5 border-t mt-1.5 ${isExpired ? "border-gray-200" : "border-blue-200"}`}>
                          <span className="font-medium text-gray-700 text-xs mb-1 block">
                            Coverage Details:
                          </span>
                          <div className="space-y-1 text-xs">
                            {insurance.copay.Default.copay_details &&
                              insurance.copay.Default.copay_details.length >
                              0 && (
                                <div className="bg-gray-50 rounded p-1.5">
                                  <p className="font-medium text-gray-800 mb-0.5 text-xs">
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
                                <div className="bg-gray-50 rounded p-1.5">
                                  <p className="font-medium text-gray-800 mb-0.5 text-xs">
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

                      {/* Check Eligibility Button and Form */}
                      {(() => {
                        const insuranceKey = insurance.patient_insurance_tpa_policy_id || index;
                        const isActive = insurance.insurance_status?.toLowerCase() === "active";
                        const showForm = showEligibilityFormFor.has(insuranceKey);

                        // For active insurance, check visibility rules
                        if (isActive) {
                          let shouldShowButton = eligibilityButtonStates[insuranceKey];
                          if (shouldShowButton === undefined) {
                            shouldShowButton = checkEligibilityButtonVisibility(insurance);
                          }

                          if (shouldShowButton) {
                            return (
                              <div className={`pt-2 border-t mt-2 ${isExpired ? "border-gray-200" : "border-blue-200"}`}>
                                <Button
                                  onClick={() => handleCheckEligibility(insurance, insuranceKey)}
                                  className={`w-full text-xs py-1.5 ${showForm
                                    ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300"
                                    : "bg-green-600 hover:bg-green-700 text-white"
                                    }`}
                                  size="sm"
                                >
                                  {showForm ? "▼ Hide Eligibility Form" : "✓ Check Eligibility with Mantys"}
                                </Button>
                                {showForm && (
                                  <div className="mt-4">
                                    <MantysEligibilityForm
                                      patientData={patientData}
                                      insuranceData={insurance}
                                      onClose={() => handleCloseForm(insuranceKey)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          }
                        }

                        // For expired insurance, always show button with grey styling
                        if (isExpired) {
                          return (
                            <div className="pt-2 border-t border-gray-200 mt-2">
                              <Button
                                onClick={() => handleCheckEligibility(insurance, insuranceKey)}
                                className={`w-full text-xs py-1.5 ${showForm
                                  ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300"
                                  : "bg-gray-500 hover:bg-gray-600 text-white"
                                  }`}
                                size="sm"
                              >
                                {showForm ? "▼ Hide Eligibility Form" : "✓ Check Eligibility with Mantys"}
                              </Button>
                              {showForm && (
                                <div className="mt-4">
                                  <MantysEligibilityForm
                                    patientData={patientData}
                                    insuranceData={insurance}
                                    onClose={() => handleCloseForm(insuranceKey)}
                                  />
                                </div>
                              )}
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

      </div>
    );
  };
