import React, { useState, useMemo } from "react";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { Drawer } from "./ui/drawer";
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

  const { data: selectedItem } = useEligibilityHistoryItem(selectedItemId || "", !!selectedItemId);

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
    if ((item.status === "complete" || item.status === "error") && item.result) {
      setShowDrawer(true);
    } else {
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

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      await clearAll.mutateAsync();
    }
  };

  const getStatusBadge = (status: EligibilityHistoryItem["status"]) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      processing: "bg-blue-100 text-blue-800 border-blue-300",
      complete: "bg-green-100 text-green-800 border-green-300",
      error: "bg-red-100 text-red-800 border-red-300",
    };

    const labels = {
      pending: "Pending",
      processing: "Processing",
      complete: "Complete",
      error: "Failed",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[status]}`}
      >
        {labels[status]}
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

  const resultData = (freshResult?.result || selectedItem?.result) as MantysEligibilityResponse | undefined;

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
        <button
          onClick={handleClearAll}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
        >
          Clear All
        </button>
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
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
                      {getStatusBadge(item.status)}
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
            ) : resultData ? (
              <MantysResultsDisplay
                response={resultData}
                onClose={handleCloseDrawer}
                onCheckAnother={handleCheckAnother}
                screenshot={selectedItem.interimResults?.screenshot || null}
                patientMPI={selectedItem.patientMPI}
                patientId={enrichedPatientId || (selectedItem.patientId ? parseInt(selectedItem.patientId) : undefined)}
                appointmentId={selectedItem.appointmentId}
                encounterId={selectedItem.encounterId}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No results available</p>
              </div>
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
