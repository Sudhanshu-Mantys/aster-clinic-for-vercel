import React, { useState, useEffect, useRef } from "react";
import { Modal } from "./ui/modal";
import { EligibilityHistoryService } from "../utils/eligibilityHistory";

interface ExtractionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string; // Task ID in format: actual_task_id or tasksFor:{appointment_id}
  viewMode?: "live" | "history"; // 'live' = monitoring active check, 'history' = viewing completed check
  onMinimize?: () => void; // Callback when minimize button is clicked
  onComplete?: (result: any) => void; // Callback when task completes
}

interface TaskStatusData {
  status: "idle" | "pending" | "processing" | "complete" | "error";
  statusMessage: string;
  interimScreenshot: string | null;
  interimDocuments: Array<{ id: string; tag: string; url: string }>;
  pollingAttempts: number;
  errorMessage: string | null;
  isSearchAll?: boolean;
  searchAllStatus?: string;
  aggregatedResults?: any[];
}

export const ExtractionProgressModal: React.FC<
  ExtractionProgressModalProps
> = ({
  isOpen,
  onClose,
  taskId,
  viewMode = "live",
  onMinimize,
  onComplete,
}) => {
    const [taskData, setTaskData] = useState<TaskStatusData>({
      status: "idle",
      statusMessage: "Loading...",
      interimScreenshot: null,
      interimDocuments: [],
      pollingAttempts: 0,
      errorMessage: null,
    });
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const actualTaskIdRef = useRef<string | null>(null);

    // Extract actual task_id from tasksFor:{appointment_id} format
    const extractTaskId = async (taskIdOrKey: string): Promise<string | null> => {
      // If it's already a task_id (UUID format), return it
      if (taskIdOrKey.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return taskIdOrKey;
      }

      // If it's in format tasksFor:{appointment_id}, we need to fetch the task_id
      if (taskIdOrKey.startsWith("tasksFor:")) {
        const appointmentId = taskIdOrKey.replace("tasksFor:", "");
        try {
          // Get all eligibility history items and filter by appointment_id
          const allItems = await EligibilityHistoryService.getAll();

          // Filter by appointment_id and get the most recent one
          const itemsForAppointment = allItems
            .filter((item) => item.appointmentId?.toString() === appointmentId)
            .sort((a, b) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );

          if (itemsForAppointment.length > 0) {
            return itemsForAppointment[0].taskId;
          }
        } catch (error) {
          console.error("Error fetching task_id for appointment:", error);
        }
        return null;
      }

      return taskIdOrKey;
    };

    // Fetch status from API (which calls Mantys API)
    const fetchTaskStatus = async (actualTaskId: string) => {
      try {
        const response = await fetch("/api/mantys/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: actualTaskId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const data = await response.json();

        // Check if it's a search_all task
        const isSearchAll = data.isSearchAll === true;
        const searchAllStatus = data.searchAllStatus;
        const aggregatedResults = data.aggregatedResults || [];

        // Determine the effective status
        let effectiveStatus: "pending" | "processing" | "complete" | "error" = data.status;
        let statusMessage = data.message || "Task is being processed...";
        let isComplete = false;

        if (isSearchAll) {
          // For search_all, check search_all_status
          if (searchAllStatus === "SEARCH_ALL_COMPLETE") {
            effectiveStatus = "complete";
            statusMessage = "Search all complete!";
            isComplete = true;
          } else if (searchAllStatus === "SEARCH_ALL_PROCESSING" || data.status === "processing") {
            effectiveStatus = "processing";
            statusMessage = "Searching across all TPAs...";
          } else {
            effectiveStatus = "pending";
            statusMessage = "Starting search across all TPAs...";
          }
        } else {
          // For regular tasks, use the status from the API
          if (data.status === "complete" || data.status === "error") {
            isComplete = true;
          }
        }

        // Update task data
        setTaskData((prev) => ({
          ...prev,
          status: effectiveStatus,
          statusMessage,
          interimScreenshot: data.interimResults?.screenshot || null,
          interimDocuments: data.interimResults?.documents || [],
          pollingAttempts: prev.pollingAttempts + 1,
          errorMessage: data.status === "error" ? data.message : null,
          isSearchAll,
          searchAllStatus,
          aggregatedResults,
        }));

        // If complete, stop polling and call onComplete
        if (isComplete) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (onComplete && data.result) {
            onComplete(data.result);
          }
        }
      } catch (error: any) {
        console.error("Error fetching task status:", error);
        setTaskData((prev) => ({
          ...prev,
          status: "error",
          statusMessage: "Failed to fetch status",
          errorMessage: error.message || "An error occurred while checking status",
        }));
      }
    };

    // Start polling when modal opens
    useEffect(() => {
      if (!isOpen) {
        // Reset state when modal closes
        setTaskData({
          status: "idle",
          statusMessage: "Loading...",
          interimScreenshot: null,
          interimDocuments: [],
          pollingAttempts: 0,
          errorMessage: null,
        });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      // Extract task_id and start polling
      const initializeAndPoll = async () => {
        const actualTaskId = await extractTaskId(taskId);
        if (!actualTaskId) {
          setTaskData({
            status: "error",
            statusMessage: "Invalid task ID",
            interimScreenshot: null,
            interimDocuments: [],
            pollingAttempts: 0,
            errorMessage: `Could not find task ID for: ${taskId}`,
          });
          return;
        }

        actualTaskIdRef.current = actualTaskId;

        // Fetch immediately
        await fetchTaskStatus(actualTaskId);

        // Then poll every 5 seconds
        pollingIntervalRef.current = setInterval(() => {
          if (actualTaskIdRef.current) {
            fetchTaskStatus(actualTaskIdRef.current);
          }
        }, 5000);
      };

      initializeAndPoll();

      // Cleanup on unmount
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }, [isOpen, taskId]);

    const {
      status,
      statusMessage,
      interimScreenshot,
      interimDocuments,
      pollingAttempts,
      errorMessage,
      isSearchAll,
      aggregatedResults,
    } = taskData;
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
      if (status === "processing" && pollingAttempts > 0) {
        // Estimate progress based on attempts
        return Math.min(pollingAttempts * 2, 95); // Cap at 95% until complete
      }
      return 10; // Show some progress when pending
    };

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
          {/* Minimize Info Text */}
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
                    <strong>You can minimize this window</strong> - The eligibility check will continue running in the background. You'll be notified when it completes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              {status !== "complete" && (
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
              <h3 className={`text-lg font-semibold ${getStatusColor()}`}>
                {statusMessage}
              </h3>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>

            {/* Status Message */}
            {pollingAttempts > 0 && status !== "complete" && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Checking status... (Attempt {pollingAttempts})</span>
              </div>
            )}

            {/* Search All Status */}
            {isSearchAll && aggregatedResults && aggregatedResults.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Search All Progress ({aggregatedResults.length} TPAs checked)
                </h4>
                <div className="space-y-2">
                  {aggregatedResults.slice(0, 5).map((result: any, index: number) => (
                    <div key={index} className="text-xs text-gray-600">
                      <span className="font-medium">{result.tpa_name}:</span>{" "}
                      <span className={result.status === "failed" ? "text-red-600" : result.status === "backoff" ? "text-yellow-600" : "text-gray-600"}>
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

          {/* Live Screenshot Display */}
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
                    console.error(
                      "Failed to load screenshot:",
                      interimScreenshot,
                    );
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                Real-time screenshot of the automated extraction process
              </p>
            </div>
          )}

          {/* Interim Documents Display */}
          {interimDocuments && interimDocuments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Documents Being Processed ({interimDocuments.length})
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {interimDocuments.map((doc, index) => (
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
                      <p className="text-sm font-medium text-gray-900">
                        {doc.tag || "Document"}
                      </p>
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

          {/* Processing Info */}
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
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    What's Happening?
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1 break-words">
                    <li>• Connecting to insurance provider portal</li>
                    <li>
                      • Authenticating and navigating to eligibility section
                    </li>
                    <li>• Extracting coverage details and benefits</li>
                    <li>• Processing and validating the information</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Pending Info */}
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
                  <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                    Starting Process
                  </h4>
                  <p className="text-sm text-yellow-800 break-words">
                    Connecting to the insurance portal and preparing to extract eligibility information.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Complete Status */}
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
                      ? "This eligibility check was successfully completed. Review the extracted data above."
                      : "Successfully retrieved eligibility information from the insurance provider. You can now review the results."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Status */}
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
                  <h4 className="text-sm font-semibold text-red-900 mb-1">
                    Check Failed
                  </h4>
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
