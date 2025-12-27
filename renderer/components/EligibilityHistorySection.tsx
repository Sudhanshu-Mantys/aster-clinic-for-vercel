import React, { useState } from "react";
import type { EligibilityHistoryItem } from "../lib/api-client";

interface EligibilityHistorySectionProps {
  todaySearches: EligibilityHistoryItem[];
  olderSearches: EligibilityHistoryItem[];
  onSearchClick: (search: EligibilityHistoryItem) => void;
}

const TPA_NAME_MAP: Record<string, string> = {
  INS010: "AXA INSURANCE - GULF",
  INS015: "SAICO",
  TPA001: "Neuron",
  TPA002: "NextCare",
  TPA003: "Al Madallah",
  TPA004: "NAS",
  TPA010: "FMC (First Med)",
  TPA023: "Daman Thiqa",
  TPA036: "Mednet",
  TPA037: "Lifeline",
  INS026: "Daman",
  INS017: "ADNIC",
};

const getTPAName = (code: string): string => {
  return TPA_NAME_MAP[code] || code;
};

const normalizeStatus = (status: string) => (status === "failed" ? "error" : status);

// Helper to check if a search-all result has an eligible entry
interface AggregatedResult {
  tpa_name: string;
  status: string;
  data?: {
    is_eligible?: boolean;
    payer_id?: string;
  } | null;
}

interface SearchAllResult {
  is_search_all?: boolean;
  search_all_status?: string;
  found_results?: number;
  aggregated_results?: AggregatedResult[];
}

const getEligibleResultFromSearchAll = (search: EligibilityHistoryItem): AggregatedResult | null => {
  const result = search.result as SearchAllResult | undefined;
  if (!result) return null;

  // Check if it's a search-all complete with found results
  const isSearchAllComplete =
    result.is_search_all &&
    (result.search_all_status === "SEARCH_ALL_COMPLETE" || search.status === "complete") &&
    (result.found_results ?? 0) > 0;

  if (!isSearchAllComplete || !result.aggregated_results) return null;

  // Find the first eligible result
  return result.aggregated_results.find(
    (r) => r.status === "found" && r.data?.is_eligible === true
  ) || null;
};

const isSearchAllWithEligibleResult = (search: EligibilityHistoryItem): boolean => {
  return getEligibleResultFromSearchAll(search) !== null;
};

// Check if this is a search-all that completed but found no eligible results
const isSearchAllWithNoResults = (search: EligibilityHistoryItem): boolean => {
  const result = search.result as SearchAllResult | undefined;
  const normalizedStatus = normalizeStatus(search.status);
  const tpaCode = (search as any).tpaCode || search.insurancePayer || "";

  // If we have the result, check for search-all with no results
  if (result) {
    const isSearchAllComplete =
      result.is_search_all &&
      (result.search_all_status === "SEARCH_ALL_COMPLETE" || normalizedStatus === "complete" || normalizedStatus === "error");

    if (isSearchAllComplete) {
      // Check if found_results is 0 or no eligible entry exists
      return (result.found_results ?? 0) === 0;
    }
  }

  // Fallback: If tpaCode is "BOTH" (search-all) and status is error, assume no results found
  if (tpaCode === "BOTH" && normalizedStatus === "error") {
    return true;
  }

  return false;
};

const getSearchStatusColors = (search: EligibilityHistoryItem) => {
  const normalizedStatus = normalizeStatus(search.status);
  const isComplete = normalizedStatus === "complete";
  const isError = normalizedStatus === "error";
  const hasEligibleResult = isSearchAllWithEligibleResult(search);
  const isSearchAllNoResults = isSearchAllWithNoResults(search);

  // Search-all with no results OR regular error - show red style
  if (isSearchAllNoResults || (isError && !hasEligibleResult)) {
    return {
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      hoverBgColor: "hover:bg-red-100",
      iconBgColor: "bg-red-500",
      iconPath: "M6 18L18 6M6 6l12 12",
    };
  }

  if (isComplete || hasEligibleResult) {
    return {
      bgColor: "bg-green-50",
      borderColor: "border-green-300",
      hoverBgColor: "hover:bg-green-100",
      iconBgColor: "bg-green-500",
      iconPath: "M5 13l4 4L19 7",
    };
  }

  return {
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    hoverBgColor: "hover:bg-yellow-100",
    iconBgColor: "bg-yellow-500",
    iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  };
};

const getStatusDisplay = (search: EligibilityHistoryItem): string => {
  // Check for search-all with eligible result first
  const eligibleResult = getEligibleResultFromSearchAll(search);
  if (eligibleResult) {
    return "Eligible";
  }

  // Check for search-all with no results
  if (isSearchAllWithNoResults(search)) {
    return "Could not determine";
  }

  const normalizedStatus = normalizeStatus(search.status);
  if (normalizedStatus === "complete") return "Active";
  if (normalizedStatus === "error") return "Failed";
  return search.status;
};

const getTPADisplayForSearch = (search: EligibilityHistoryItem): { tpaCode: string; tpaName: string } => {
  // Check for search-all with eligible result - use the eligible TPA
  const eligibleResult = getEligibleResultFromSearchAll(search);
  if (eligibleResult) {
    const tpaCode = eligibleResult.tpa_name || eligibleResult.data?.payer_id || "";
    return {
      tpaCode,
      tpaName: getTPAName(tpaCode),
    };
  }

  // Fallback to the search's own TPA info
  const tpaCode = (search as any).tpaCode || search.insurancePayer || "";
  return {
    tpaCode,
    tpaName: getTPAName(tpaCode),
  };
};

export const EligibilityHistorySection: React.FC<
  EligibilityHistorySectionProps
> = ({ todaySearches, olderSearches, onSearchClick }) => {
  const [isPreviousExpanded, setIsPreviousExpanded] = useState(false);

  if (todaySearches.length === 0 && olderSearches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Today's Searches */}
      {todaySearches.length > 0 && (
        <div>
          <div className="bg-gray-100 px-4 py-2 rounded-t">
            <h3 className="text-sm font-bold text-gray-900">
              Eligibility Checks Today ({todaySearches.length})
            </h3>
          </div>
          <div className="bg-gray-50 border-2 border-gray-200 border-t-0 rounded-b p-3 space-y-3">
            {todaySearches.map((search) => {
              const date = search.createdAt
                ? new Date(search.createdAt)
                : null;
              const timeString =
                date && !isNaN(date.getTime())
                  ? date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "";

              const colors = getSearchStatusColors(search);
              const { tpaCode, tpaName } = getTPADisplayForSearch(search);

              return (
                <div
                  key={search.taskId}
                  onClick={() => onSearchClick(search)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSearchClick(search);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`${colors.bgColor} border-2 ${colors.borderColor} rounded-lg p-4 cursor-pointer ${colors.hoverBgColor} transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full ${colors.iconBgColor} flex items-center justify-center`}
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d={colors.iconPath}
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1">
                        Eligibility Verification
                      </div>
                      {timeString && (
                        <div className="text-sm text-gray-700 mb-2">
                          Verified at {timeString}
                        </div>
                      )}
                      <div className="font-bold text-gray-900 text-sm sm:text-base mb-1 truncate">
                        {tpaName}{" "}
                        {tpaCode && (
                          <span className="font-normal text-gray-600">
                            ({tpaCode})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700">
                        Status: {getStatusDisplay(search)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Older Searches (Collapsible) */}
      {olderSearches.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsPreviousExpanded(!isPreviousExpanded)}
            className="w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 flex items-center gap-2 transition-colors rounded-t focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg
              className={`w-4 h-4 text-gray-700 transition-transform ${isPreviousExpanded ? "rotate-180" : ""}`}
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
            <span className="text-sm font-medium text-gray-900">
              Previous Checks ({olderSearches.length})
            </span>
          </button>

          {isPreviousExpanded && (
            <div className="bg-gray-50 border border-gray-200 border-t-0 rounded-b px-3 py-2 space-y-1">
              {olderSearches.map((search) => {
                const { tpaCode, tpaName } = getTPADisplayForSearch(search);
                let formattedDate = "";
                if (search.createdAt) {
                  const date = new Date(search.createdAt);
                  if (!isNaN(date.getTime())) {
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const year = date.getFullYear();
                    formattedDate = `${day}/${month}/${year}`;
                  }
                }

                return (
                  <div
                    key={search.taskId}
                    onClick={() => onSearchClick(search)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSearchClick(search);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="bg-white hover:bg-gray-100 rounded px-3 py-2 text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <span className="text-gray-900">
                      {formattedDate && `${formattedDate} - `}
                      {tpaName}{" "}
                      {tpaCode && (
                        <span className="text-gray-600">({tpaCode})</span>
                      )}{" "}
                      - Status: {getStatusDisplay(search)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
