import React, { useState, useMemo } from "react";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { Drawer } from "./ui/drawer";
import { Badge } from "./ui/badge";
import {
  useEligibilityHistory,
  useActiveEligibilityChecks,
  useEligibilityHistoryItem,
  useDeleteEligibilityHistoryItem,
  useClearEligibilityHistory,
  useEligibilityTaskStatus,
  type EligibilityHistoryItem,
} from "../hooks/useEligibility";
import { usePatientContext } from "../hooks/usePatient";
import { useAuth } from "../contexts/AuthContext";
import type { MantysEligibilityResponse } from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";

interface EligibilityHistoryListProps {
  onRefresh?: () => void;
}

export const EligibilityHistoryList: React.FC<EligibilityHistoryListProps> = ({
  onRefresh,
}) => {
  const { user } = useAuth();
  const clinicId = user?.selected_team_id;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const { data: allHistory = [], refetch: refetchHistory } = useEligibilityHistory(clinicId);
  const { data: activeChecks = [] } = useActiveEligibilityChecks(clinicId);
  const deleteItem = useDeleteEligibilityHistoryItem();
  const clearAll = useClearEligibilityHistory();

  const { data: selectedItem } = useEligibilityHistoryItem(selectedItemId || "", {
    enabled: !!selectedItemId,
  });

  const { data: patientContext } = usePatientContext(
    {
      appointmentId: selectedItem?.appointmentId?.toString(),
      mpi: selectedItem?.patientMPI,
    },
    { enabled: !!selectedItem && (!!selectedItem.appointmentId || !!selectedItem.patientMPI) }
  );

  const { data: freshResult, isLoading: loadingFreshResult } = useEligibilityTaskStatus(
    selectedItem?.taskId || "",
    {
      enabled: !!selectedItem?.taskId && (selectedItem?.status === "complete" || selectedItem?.status === "error"),
      refetchInterval: false,
    }
  );

  const enrichedPatientId = patientContext?.patientId
    ? parseInt(patientContext.patientId)
    : undefined;

  const enrichedPhysicianId = (() => {
    const physicianIdValue = patientContext?.physician_id || patientContext?.physicianId;
    if (!physicianIdValue) return undefined;
    if (typeof physicianIdValue === 'number') return physicianIdValue;
    const parsed = parseInt(String(physicianIdValue), 10);
    return isNaN(parsed) ? undefined : parsed;
  })();

  const historyItems = useMemo(() => {
    let items = allHistory;

    if (filterStatus === "active") {
      items = items.filter((item) => item.status === "pending" || item.status === "processing");
    } else if (filterStatus === "completed") {
      items = items.filter((item) => item.status === "complete" || item.status === "error");
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.patientId.toLowerCase().includes(lowerQuery) ||
          item.patientName?.toLowerCase().includes(lowerQuery) ||
          item.insurancePayer?.toLowerCase().includes(lowerQuery)
      );
    }

    return items;
  }, [allHistory, filterStatus, searchQuery]);

  const activeCount = activeChecks.length;

  const handleViewDetails = (item: EligibilityHistoryItem) => {
    setSelectedItemId(item.id);
    
    // Log for debugging
    console.log("[EligibilityHistoryList] View details for item:", {
      id: item.id,
      status: item.status,
      taskId: item.taskId,
      hasResult: !!item.result,
      result: item.result,
      error: item.error,
    });
    
    if (item.status === "complete" || item.status === "error") {
      // Always show drawer for completed or error status
      // The drawer will display results or error message appropriately
      setShowDrawer(true);
    } else {
      // Pending/processing - show modal for live progress
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItemId(null);
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setSelectedItemId(null);
  };

  const handleCheckAnother = () => {
    setShowDrawer(false);
    setShowModal(false);
    setSelectedItemId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this eligibility check?")) {
      await deleteItem.mutateAsync(id);
    }
  };



  const getStatusBadge = (item: EligibilityHistoryItem) => {
    // Extract the actual detailed status from the result
    let actualStatus: string = item.status;
    let displayLabel: string = item.status;

    // Try to get the detailed status from result
    if (item.result) {
      const result = item.result as any;
      const dataDump = result.data_dump;
      const resultStatus = result.status;

      // For PROCESS_COMPLETE or search-all cases, check is_eligible flag
      if (resultStatus === "PROCESS_COMPLETE" || result.is_search_all) {
        // Check if any aggregated results have eligible entries
        if (result.aggregated_results && Array.isArray(result.aggregated_results)) {
          const hasEligible = result.aggregated_results.some(
            (aggResult: any) => aggResult.data?.is_eligible === true
          );
          if (hasEligible) {
            actualStatus = "eligible";
            displayLabel = "eligible";
          } else if (result.found_results === 0 || result.is_search_all) {
            // For search-all with no eligible results, show "Could Not Determine"
            actualStatus = "could_not_determine";
            displayLabel = "could_not_determine";
          }
        }
        // Check is_eligible in data_dump for single TPA checks
        else if (dataDump?.is_eligible === true) {
          actualStatus = "eligible";
          displayLabel = "eligible";
        } else if (dataDump?.is_eligible === false) {
          actualStatus = "not_eligible";
          displayLabel = "not_eligible";
        }
      }
      // For other statuses, use the result status
      else if (resultStatus) {
        actualStatus = resultStatus;
        displayLabel = resultStatus;
      }
    }

    const badges: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      processing: "bg-blue-100 text-blue-800 border-blue-300",
      complete: "bg-green-100 text-green-800 border-green-300",
      eligible: "bg-green-100 text-green-800 border-green-300",
      not_eligible: "bg-red-100 text-red-800 border-red-300",
      could_not_determine: "bg-red-100 text-red-800 border-red-300",
      found: "bg-green-100 text-green-800 border-green-300",
      error: "bg-red-100 text-red-800 border-red-300",
      failed: "bg-red-100 text-red-800 border-red-300",
      invalid_credentials: "bg-orange-100 text-orange-800 border-orange-300",
      member_not_found: "bg-red-100 text-red-800 border-red-300",
      not_found: "bg-gray-100 text-gray-800 border-gray-300",
      backoff: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };

    const labels: Record<string, string> = {
      pending: "Pending",
      processing: "Processing",
      complete: "Complete",
      eligible: "Eligible",
      not_eligible: "Not Eligible",
      could_not_determine: "Could Not Determine",
      found: "Found",
      error: "Failed",
      failed: "Failed",
      invalid_credentials: "Invalid Credentials",
      member_not_found: "Not Eligible",
      not_found: "Not Found",
      backoff: "Rate Limited",
    };

    const badgeClass = badges[actualStatus] || "bg-gray-100 text-gray-800 border-gray-300";
    const label = labels[actualStatus] || actualStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}
      >
        {label}
      </span>
    );
  };

  const getStatusIcon = (status: EligibilityHistoryItem["status"]) => {
    switch (status) {
      case "pending":
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "processing":
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case "complete":
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "error":
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const resultData = useMemo(() => {
    const rawResult = freshResult?.result || selectedItem?.result;
    if (!rawResult) return undefined;

    // Check if this is a search-all result
    const searchAllResult = rawResult as any;
    if (
      searchAllResult.is_search_all === true &&
      searchAllResult.aggregated_results &&
      Array.isArray(searchAllResult.aggregated_results)
    ) {
      // Find the eligible result from aggregated_results
      const eligibleEntry = searchAllResult.aggregated_results.find(
        (r: any) => r.status === "found" && r.data?.is_eligible === true
      );

      if (eligibleEntry && eligibleEntry.data) {
        // Transform to MantysEligibilityResponse format
        return {
          tpa: eligibleEntry.tpa_name || eligibleEntry.data?.payer_id || "",
          data: eligibleEntry.data,
          status: "found" as const,
          job_task_id: eligibleEntry.data?.job_task_id || searchAllResult.task_id || "",
          task_id: searchAllResult.task_id,
        } as MantysEligibilityResponse;
      }

      // No eligible result found in search-all - return first result with data for display
      const firstResultWithData = searchAllResult.aggregated_results.find(
        (r: any) => r.data
      );
      
      if (firstResultWithData) {
        return {
          tpa: firstResultWithData.tpa_name || "",
          data: firstResultWithData.data,
          status: "not_found" as const,
          job_task_id: firstResultWithData.data?.job_task_id || "",
          task_id: searchAllResult.task_id,
          // Include all aggregated results for display
          aggregated_results: searchAllResult.aggregated_results,
        } as MantysEligibilityResponse & { aggregated_results?: any[] };
      }

      return undefined;
    }

    // Regular (non-search-all) result
    return rawResult as MantysEligibilityResponse;
  }, [freshResult, selectedItem]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Eligibility Check History</h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount > 0 && (
              <span className="inline-flex items-center">
                <span className="flex h-2 w-2 relative mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {activeCount} active check{activeCount > 1 ? "s" : ""} running
              </span>
            )}
          </p>
        </div>

      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by patient ID, name, or payer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex gap-2">
          {(["all", "active", "completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {historyItems.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No eligibility checks found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || filterStatus !== "all"
                ? "Try adjusting your filters or search query"
                : "Start by checking eligibility for a patient"}
            </p>
          </div>
        ) : (
          historyItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleViewDetails(item)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(item.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {item.patientName || "Unknown Patient"}
                      </h3>
                      {getStatusBadge(item)}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Patient ID:</span> {item.patientId}
                      </p>
                      {item.dateOfBirth && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">DOB:</span> {item.dateOfBirth}
                        </p>
                      )}
                      {item.insurancePayer && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Payer:</span> {item.insurancePayer}
                        </p>
                      )}
                      {item.taskId && (
                        <p className="text-xs text-gray-500 font-mono">Task: {item.taskId}</p>
                      )}
                    </div>

                    {item.error && (
                      <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">{item.error}</p>
                    )}

                    {item.pollingAttempts && item.status === "processing" && (
                      <p className="text-xs text-gray-500 mt-2">
                        Polling attempt: {item.pollingAttempts}/150
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                    {item.completedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Completed {formatDate(item.completedAt)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition-all"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showDrawer && selectedItem && (selectedItem.status === "complete" || selectedItem.status === "error") && (
        <Drawer
          isOpen={showDrawer}
          onClose={handleCloseDrawer}
          title={`Eligibility Check Results - ${selectedItem.patientName || selectedItem.patientId}`}
          headerRight={
            resultData ? (
              (() => {
                const keyFields = extractMantysKeyFields(resultData);
                // Check if this is a search-all with no eligible results
                const resultAsAny = resultData as any;
                const isSearchAllNoResults = resultAsAny.is_search_all &&
                  resultAsAny.aggregated_results &&
                  !resultAsAny.aggregated_results.some((r: any) => r.data?.is_eligible === true);

                if (isSearchAllNoResults) {
                  return (
                    <Badge className="bg-red-100 text-red-800">
                      Could Not Determine
                    </Badge>
                  );
                }

                return (
                  <Badge className={keyFields.isEligible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {keyFields.isEligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                );
              })()
            ) : selectedItem.status === "error" ? (
              <Badge className="bg-red-100 text-red-800">Failed</Badge>
            ) : null
          }
          size="xl"
        >
          <div className="p-6">
            {loadingFreshResult ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading results...</p>
                </div>
              </div>
            ) : (
              <MantysResultsDisplay
                response={resultData}
                onClose={handleCloseDrawer}
                onCheckAnother={handleCheckAnother}
                screenshot={selectedItem.interimResults?.screenshot || null}
                patientName={selectedItem.patientName}
                patientMPI={selectedItem.patientMPI}
                patientId={enrichedPatientId || (selectedItem.patientId ? parseInt(selectedItem.patientId) : undefined)}
                appointmentId={selectedItem.appointmentId}
                encounterId={selectedItem.encounterId}
                physicianId={enrichedPhysicianId}
                errorMessage={selectedItem.error || freshResult?.error}
                taskId={selectedItem.taskId}
              />
            )}
          </div>
        </Drawer>
      )}

      {showModal && selectedItem && selectedItem.taskId && (
        <ExtractionProgressModal
          isOpen={showModal}
          onClose={handleCloseModal}
          taskId={selectedItem.taskId}
          viewMode="history"
        />
      )}
    </div>
  );
};
