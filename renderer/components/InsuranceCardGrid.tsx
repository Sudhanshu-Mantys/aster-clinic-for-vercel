import React from "react";
import { InsuranceCard } from "./InsuranceCard";
import type { InsuranceData } from "../lib/api-client";
import type { TPAConfig } from "../hooks/useClinicConfig";

interface InsuranceCardGridProps {
  insuranceDetails: InsuranceData[];
  isLoading: boolean;
  error: string | null;
  selectedInsuranceId: number | null;
  onSelectInsurance: (insurance: InsuranceData) => void;
  tpaConfigs?: TPAConfig[];
}

export const InsuranceCardGrid: React.FC<InsuranceCardGridProps> = ({
  insuranceDetails,
  isLoading,
  error,
  selectedInsuranceId,
  onSelectInsurance,
  tpaConfigs,
}) => {
  const activeCount = insuranceDetails.filter(
    (ins) => ins.insurance_status?.toLowerCase() === "active"
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Insurance Policies
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border-2 border-gray-200 p-3 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="flex gap-1.5">
                <div className="h-5 bg-gray-200 rounded w-16"></div>
                <div className="h-5 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-red-900">
              Error Loading Insurance
            </h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (insuranceDetails.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <svg
          className="w-12 h-12 text-gray-400 mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm text-gray-600 font-medium">
          No insurance policies found
        </p>
        <p className="text-xs text-gray-500 mt-1">
          You can still check eligibility across all TPAs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Insurance Policies
        </h3>
        {activeCount > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {activeCount} active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insuranceDetails.map((insurance, index) => {
          const key = insurance.patient_insurance_tpa_policy_id || index;
          return (
            <InsuranceCard
              key={key}
              insurance={insurance}
              isSelected={selectedInsuranceId === key}
              onSelect={onSelectInsurance}
              index={index}
              tpaConfigs={tpaConfigs}
            />
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Select an insurance policy to check eligibility
      </p>
    </div>
  );
};
