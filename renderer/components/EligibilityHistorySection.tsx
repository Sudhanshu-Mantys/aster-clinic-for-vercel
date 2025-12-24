import React, { useState } from "react";
import type { EligibilityHistoryItem } from "../lib/api-client";

interface EligibilityHistorySectionProps {
  todaySearches: EligibilityHistoryItem[];
  olderSearches: EligibilityHistoryItem[];
  onSearchClick: (search: EligibilityHistoryItem) => void;
}

const TPA_NAME_MAP: Record<string, string> = {
  INS010: "AXA INSURANCE - GULF",
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

const getSearchStatusColors = (search: EligibilityHistoryItem) => {
  const isComplete = search.status === "complete";
  const isError = search.status === "error";

  if (isError) {
    return {
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-300",
      hoverBgColor: "hover:bg-yellow-100",
      iconBgColor: "bg-yellow-500",
      iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    };
  }

  if (isComplete) {
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

const getStatusDisplay = (status: string): string => {
  if (status === "complete") return "Active";
  if (status === "error") return "Failed";
  return status;
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
              const tpaCode =
                (search as any).tpaCode || search.insurancePayer || "";

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
                        {getTPAName(tpaCode)}{" "}
                        {tpaCode && (
                          <span className="font-normal text-gray-600">
                            ({tpaCode})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700">
                        Status: {getStatusDisplay(search.status)}
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
                const tpaCode =
                  (search as any).tpaCode || search.insurancePayer || "";
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
                      {getTPAName(tpaCode)}{" "}
                      {tpaCode && (
                        <span className="text-gray-600">({tpaCode})</span>
                      )}{" "}
                      - Status: {getStatusDisplay(search.status)}
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
