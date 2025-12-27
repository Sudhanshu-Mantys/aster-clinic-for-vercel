import React, { useMemo } from "react";
import { Badge } from "./ui/badge";
import type { InsuranceData } from "../lib/api-client";
import type { TPAConfig } from "../hooks/useClinicConfig";

interface InsuranceCardProps {
  insurance: InsuranceData;
  isSelected: boolean;
  onSelect: (insurance: InsuranceData) => void;
  index: number;
  tpaConfigs?: TPAConfig[];
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

/**
 * Get TPA name from insurance data, looking up from TPA configs if tpa_name is missing
 */
function getTPAName(
  insurance: InsuranceData,
  tpaConfigs?: TPAConfig[]
): string | null {
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

export const InsuranceCard: React.FC<InsuranceCardProps> = ({
  insurance,
  isSelected,
  onSelect,
  index,
  tpaConfigs,
}) => {
  const isActive = insurance.insurance_status?.toLowerCase() === "active";
  const isExpired = insurance.insurance_status?.toLowerCase() === "expired";
  const isValid = insurance.is_valid === 1;

  const payerName = insurance.payer_name || `Insurance ${index + 1}`;
  const tpaName = useMemo(
    () => getTPAName(insurance, tpaConfigs),
    [insurance, tpaConfigs]
  );
  const tpaPolicyId = insurance.tpa_policy_id || "N/A";
  const expiryDate = formatExpiryDate(insurance.ins_exp_date);

  const handleClick = () => {
    if (!isExpired) {
      onSelect(insurance);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isExpired) {
      e.preventDefault();
      onSelect(insurance);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isExpired ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      aria-disabled={isExpired}
      className={`
        rounded-lg p-3 transition-all border-2
        ${isSelected
          ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200"
          : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
        }
        ${isExpired ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
      `}
    >
      <div className="space-y-1.5">
        {/* TPA Name - Main Header */}
        <h4 className="font-semibold text-sm text-gray-900 truncate">
          {tpaName || "Unknown TPA"}
        </h4>

        {/* Payer Name */}
        <div className="text-xs text-gray-600">
          <span className="text-gray-500">Payer: </span>
          <span className="font-medium text-gray-800">{payerName}</span>
        </div>

        {/* TPA Policy ID */}
        <div className="text-xs text-gray-600">
          <span className="text-gray-500">Policy ID: </span>
          <span className="font-medium text-gray-800">{tpaPolicyId}</span>
        </div>

        {/* Expiry Date */}
        <div className="text-xs text-gray-600">
          <span className="text-gray-500">Expires: </span>
          <span className={`font-medium ${isExpired ? "text-red-600" : "text-gray-800"}`}>
            {expiryDate}
          </span>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge
            className={`text-xs font-medium ${isActive
              ? "bg-green-100 text-green-800 border border-green-200"
              : isExpired
                ? "bg-red-100 text-red-800 border border-red-200"
                : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
          >
            {insurance.insurance_status || "Unknown"}
          </Badge>
          {isValid && (
            <Badge className="text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              Valid
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};
