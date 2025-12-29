import React, { useMemo } from "react";
import { Badge } from "./ui/badge";
import type { InsuranceData } from "../lib/api-client";
import type { TPAConfig } from "../hooks/useClinicConfig";

interface StickyEligibilityToolbarProps {
  selectedInsurance: InsuranceData | null;
  isLoading: boolean;
  hasActiveInsurance: boolean;
  hasAnyInsurance: boolean;
  tpaConfigs?: TPAConfig[];
}

/**
 * Get TPA name from insurance data, looking up from TPA configs if tpa_name is missing
 */
function getTPAName(
  insurance: InsuranceData | null,
  tpaConfigs?: TPAConfig[]
): string | null {
  if (!insurance) return null;

  // First, try the direct tpa_name field
  if (insurance.tpa_name) {
    return insurance.tpa_name;
  }

  // If tpa_name is missing, try to look it up from payer_code or receiver_code
  if (tpaConfigs && tpaConfigs.length > 0) {
    const code = insurance.payer_code || insurance.receiver_code;
    if (code) {
      const tpaConfig = tpaConfigs.find(
        (config) => {
          const configAny = config as any;
          return (
            configAny.ins_code === code ||
            configAny.tpa_code === code ||
            configAny.payer_code === code
          );
        }
      );
      if (tpaConfig) {
        // Prefer tpa_name, then insurance_name, then ins_payer
        const configAny = tpaConfig as any;
        const tpaName = typeof configAny.tpa_name === 'string' ? configAny.tpa_name : null;
        const insuranceName = typeof configAny.insurance_name === 'string' ? configAny.insurance_name : null;
        const insPayer = typeof configAny.ins_payer === 'string' ? configAny.ins_payer : null;
        return tpaName || insuranceName || insPayer || null;
      }
    }
  }

  return null;
}

const formatExpiryDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export const StickyEligibilityToolbar: React.FC<
  StickyEligibilityToolbarProps
> = ({
  selectedInsurance,
  isLoading,
  hasActiveInsurance,
  hasAnyInsurance,
  tpaConfigs,
}) => {
    const payerName = selectedInsurance?.payer_name;
    const tpaName = useMemo(
      () => getTPAName(selectedInsurance, tpaConfigs),
      [selectedInsurance, tpaConfigs]
    );
    const tpaPolicyId = selectedInsurance?.tpa_policy_id;
    const expiryDate = formatExpiryDate(selectedInsurance?.ins_exp_date);
    const isActive = selectedInsurance?.insurance_status?.toLowerCase() === "active";
    const isValid = selectedInsurance?.is_valid === 1;

    const getHelperText = () => {
      if (isLoading) return "Loading insurance details...";
      if (!hasAnyInsurance)
        return "No insurance on file - eligibility form shown below";
      if (!hasActiveInsurance)
        return "No active insurance policies - select one from cards below";
      if (!selectedInsurance) return "Select an insurance policy below";
      return null;
    };

    const helperText = getHelperText();

    return (
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm p-4">
        {/* Selected Insurance Details */}
        {selectedInsurance ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* TPA Name - Main Header */}
                <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                  {tpaName || "Unknown TPA"}
                </div>

                {/* Payer Name */}
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                  <span className="text-gray-500">Payer: </span>
                  <span className="font-medium text-gray-800">
                    {payerName || "N/A"}
                  </span>
                </div>

                {/* TPA Policy ID */}
                <div className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  <span className="text-gray-500">Policy ID: </span>
                  <span className="font-medium text-gray-800 break-all">
                    {tpaPolicyId || "N/A"}
                  </span>
                </div>

                {/* Expiry Date */}
                <div className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  <span className="text-gray-500">Expires: </span>
                  <span className="font-medium text-gray-800">{expiryDate}</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-col gap-1 items-end flex-shrink-0">
                <Badge
                  className={`text-xs ${isActive
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-red-100 text-red-800 border border-red-200"
                    }`}
                >
                  {selectedInsurance.insurance_status || "Unknown"}
                </Badge>
                {isValid && (
                  <Badge className="text-xs bg-blue-100 text-blue-800 border border-blue-200">
                    Valid
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          helperText && (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg border border-gray-200">
              {helperText}
            </div>
          )
        )}
      </div>
    );
  };
