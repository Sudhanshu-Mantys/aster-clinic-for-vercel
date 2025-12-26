import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "./ui/modal";
import {
  useEligibilityTaskStatus,
  useEligibilityHistory,
  useEligibilityHistoryByTaskId,
} from "../hooks/useEligibility";
import { useAuth } from "../contexts/AuthContext";

interface ExtractionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  viewMode?: "live" | "history";
  onMinimize?: () => void;
  onComplete?: (result: any) => void;
}

export const ExtractionProgressModal: React.FC<ExtractionProgressModalProps> = ({
  isOpen,
  onClose,
  taskId,
  viewMode = "live",
  onMinimize,
  onComplete,
}) => {
  const { user } = useAuth();
  const clinicId = user?.selected_team_id;

  const [actualTaskId, setActualTaskId] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  const [v3Result, setV3Result] = useState<unknown | null>(null);

  const { data: historyItems = [] } = useEligibilityHistory(clinicId);

  useEffect(() => {
    if (!isOpen) {
      setActualTaskId(null);
      setPollingAttempts(0);
      setHasCalledComplete(false);
      return;
    }

    if (taskId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setActualTaskId(taskId);
      return;
    }

    if (taskId.startsWith("tasksFor:")) {
      const appointmentId = taskId.replace("tasksFor:", "");
      const itemsForAppointment = historyItems
        .filter((item) => item.appointmentId?.toString() === appointmentId)
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

      if (itemsForAppointment.length > 0) {
        setActualTaskId(itemsForAppointment[0].taskId);
      }
    } else {
      setActualTaskId(taskId);
    }
  }, [isOpen, taskId, historyItems]);

  const { data: taskStatus } = useEligibilityTaskStatus(actualTaskId || "", {
    enabled: isOpen && !!actualTaskId,
    refetchInterval: 5000,
  });

  const status = taskStatus?.status || "pending";

  const { data: historyItem } = useEligibilityHistoryByTaskId(actualTaskId || "", isOpen && !!actualTaskId && status === "error");

  useEffect(() => {
    if (!isOpen || !actualTaskId) {
      setV3Result(null);
      return;
    }

    if (!["error", "complete"].includes(status)) {
      setV3Result(null);
      return;
    }

    let isMounted = true;
    const fetchV3Result = async () => {
      try {
        const response = await fetch(
          `/api/mantys/eligibility-result-v3?task_id=${encodeURIComponent(actualTaskId)}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch v3 result: ${response.status}`);
        }
        const resultData = await response.json();
        if (isMounted) {
          setV3Result(resultData);
        }
      } catch (error) {
        console.error("Failed to fetch v3 eligibility result:", error);
      }
    };

    fetchV3Result();
    return () => {
      isMounted = false;
    };
  }, [actualTaskId, isOpen, status]);

  useEffect(() => {
    if (taskStatus) {
      setPollingAttempts((prev) => prev + 1);
    }
  }, [taskStatus]);

  useEffect(() => {
    if (
      taskStatus?.status === "complete" &&
      taskStatus?.result &&
      onComplete &&
      !hasCalledComplete
    ) {
      setHasCalledComplete(true);
      onComplete(taskStatus.result);
    }
  }, [taskStatus, onComplete, hasCalledComplete]);

  const v3ErrorMessage = useMemo(() => {
    const dataDump = (v3Result as any)?.eligibility_result?.data_dump;
    if (!dataDump) return null;
    return dataDump.message || dataDump.error_type || dataDump.status || null;
  }, [v3Result]);

  const displayError = useMemo(() => {
    if (status !== "error") return null;
    return v3ErrorMessage || historyItem?.error || taskStatus?.error || "An error occurred";
  }, [status, v3ErrorMessage, historyItem, taskStatus]);

  const statusMessage = useMemo(() => {
    if (!taskStatus) return "Loading...";

    const isSearchAll = (taskStatus as any).isSearchAll === true;
    const searchAllStatus = (taskStatus as any).searchAllStatus;

    if (isSearchAll) {
      if (searchAllStatus === "SEARCH_ALL_COMPLETE") return "Search all complete!";
      if (searchAllStatus === "SEARCH_ALL_PROCESSING" || status === "processing") {
        return "Searching across all TPAs...";
      }
      return "Starting search across all TPAs...";
    }

    if (status === "complete") return "Eligibility check complete!";
    if (status === "error") return displayError || "An error occurred";
    if (status === "processing") return "Processing eligibility check...";
    return "Starting eligibility check...";
  }, [taskStatus, status, displayError]);

  const interimScreenshot = taskStatus?.screenshot || null;
  const interimDocuments = taskStatus?.documents || [];
  const errorMessage = displayError;
  const isSearchAll = (taskStatus as any)?.isSearchAll === true;
  const aggregatedResults = (taskStatus as any)?.aggregatedResults || [];

  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return "text-yellow-600";
      case "processing":
        return "text-blue-600";
      case "complete":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getProgressPercentage = () => {
    if (status === "complete") return 100;
    if (status === "error") return 100;
    if (status === "processing" && pollingAttempts > 0) {
      return Math.min(pollingAttempts * 2, 95);
    }
    return 10;
  };

  if (!actualTaskId && isOpen && !taskId.startsWith("tasksFor:")) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Error" showCloseButton>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Invalid task ID: {taskId}</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === "history"
          ? "Eligibility Check Details"
          : "Insurance Eligibility Check in Progress"
      }
      showCloseButton={viewMode === "history" || status === "complete"}
      showMinimizeButton={viewMode === "live" && status !== "complete" && onMinimize !== undefined}
      onMinimize={onMinimize}
    >
      <div className="p-6">
        {viewMode === "live" && status !== "complete" && onMinimize && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  <strong>You can minimize this window</strong> - The eligibility check will
                  continue running in the background.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            {status === "processing" && (
              <svg
                className="animate-spin h-6 w-6 text-blue-600"
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
            )}
            {status === "complete" && (
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {status === "error" && (
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {status === "pending" && (
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <h3 className={`text-lg font-semibold ${getStatusColor()}`}>{statusMessage}</h3>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                status === "error" ? "bg-red-600" : "bg-blue-600"
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>

          {pollingAttempts > 0 && status !== "complete" && status !== "error" && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Checking status... (Attempt {pollingAttempts})</span>
            </div>
          )}

          {isSearchAll && aggregatedResults.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Search All Progress ({aggregatedResults.length} TPAs checked)
              </h4>
              <div className="space-y-2">
                {aggregatedResults.slice(0, 5).map((result: any, index: number) => (
                  <div key={index} className="text-xs text-gray-600">
                    <span className="font-medium">{result.tpa_name}:</span>{" "}
                    <span
                      className={
                        result.status === "failed"
                          ? "text-red-600"
                          : result.status === "backoff"
                            ? "text-yellow-600"
                            : "text-gray-600"
                      }
                    >
                      {result.status}
                    </span>
                    {result.message && (
                      <span className="text-gray-500 ml-2">- {result.message}</span>
                    )}
                  </div>
                ))}
                {aggregatedResults.length > 5 && (
                  <div className="text-xs text-gray-500">
                    + {aggregatedResults.length - 5} more TPAs...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {interimScreenshot && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-700">
                Live View: Extracting Data from TPA Portal
              </h4>
            </div>
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-md">
              <img
                src={interimScreenshot}
                alt="TPA Portal Extraction in Progress"
                className="w-full h-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              Real-time screenshot of the automated extraction process
            </p>
          </div>
        )}

        {interimDocuments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Documents Being Processed ({interimDocuments.length})
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {interimDocuments.map((doc: any, index: number) => (
                <div
                  key={doc.id || index}
                  className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{doc.tag || "Document"}</p>
                    <p className="text-xs text-gray-500">ID: {doc.id}</p>
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "processing" && !interimScreenshot && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">What's Happening?</h4>
                <ul className="text-sm text-blue-800 space-y-1 break-words">
                  <li>• Connecting to insurance provider portal</li>
                  <li>• Authenticating and navigating to eligibility section</li>
                  <li>• Extracting coverage details and benefits</li>
                  <li>• Processing and validating the information</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-yellow-900 mb-1">Starting Process</h4>
                <p className="text-sm text-yellow-800 break-words">
                  Connecting to the insurance portal and preparing to extract eligibility
                  information.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "complete" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-green-900 mb-1">
                  {viewMode === "history"
                    ? "Eligibility Check Completed"
                    : "Eligibility Check Complete!"}
                </h4>
                <p className="text-sm text-green-800 break-words">
                  {viewMode === "history"
                    ? "This eligibility check was successfully completed."
                    : "Successfully retrieved eligibility information from the insurance provider."}
                </p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-red-900 mb-1">Check Failed</h4>
                <p className="text-sm text-red-800 break-words">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExtractionProgressModal;
