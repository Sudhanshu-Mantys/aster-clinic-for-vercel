import React from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { InsuranceData } from "../lib/api-client";

interface StickyEligibilityToolbarProps {
  selectedInsurance: InsuranceData | null;
  onCheckEligibility: () => void;
  isLoading: boolean;
  hasActiveInsurance: boolean;
  hasAnyInsurance: boolean;
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
  onCheckEligibility,
  isLoading,
  hasActiveInsurance,
  hasAnyInsurance,
}) => {
  const payerName = selectedInsurance?.payer_name;
  const tpaName = selectedInsurance?.tpa_name;
  const tpaPolicyId = selectedInsurance?.tpa_policy_id;
  const expiryDate = formatExpiryDate(selectedInsurance?.ins_exp_date);
  const isActive = selectedInsurance?.insurance_status?.toLowerCase() === "active";
  const isValid = selectedInsurance?.is_valid === 1;

  const canCheck = selectedInsurance || !hasAnyInsurance;
  const isDisabled = isLoading || (!canCheck && hasAnyInsurance);

  const getHelperText = () => {
    if (isLoading) return "Loading insurance details...";
    if (!hasAnyInsurance)
      return "No insurance on file - check eligibility across all TPAs";
    if (!hasActiveInsurance)
      return "No active insurance policies - select one to check anyway";
    if (!selectedInsurance) return "Select an insurance policy below";
    return null;
  };

  const helperText = getHelperText();

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm p-4">
      {/* Selected Insurance Details */}
      {selectedInsurance ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
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
                className={`text-xs ${
                  isActive
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
          <div className="text-sm text-gray-500 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            {helperText}
          </div>
        )
      )}

      {/* Check Eligibility Button */}
      <Button
        onClick={onCheckEligibility}
        disabled={isDisabled}
        className={`
          w-full py-3 text-base font-semibold transition-colors
          ${
            isDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300"
              : "bg-green-600 hover:bg-green-700 text-white"
          }
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Check Eligibility
          </span>
        )}
      </Button>
    </div>
  );
};
