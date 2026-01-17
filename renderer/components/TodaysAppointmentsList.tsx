import React, { useState, useMemo, useCallback } from "react";
import { Drawer } from "./ui/drawer";
import { Badge } from "./ui/badge";
import { EligibilityDrawerContent } from "./EligibilityDrawerContent";
import { MantysEligibilityForm } from "./MantysEligibilityForm";
import {
  AppointmentsFilterForm,
  AppointmentFilters,
} from "./AppointmentsFilterForm";
import { AppointmentsTable } from "./AppointmentsTable";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { useAuth } from "../contexts/AuthContext";
import {
  useAppointmentSearch,
  formatDateForApi,
  type AppointmentData,
} from "../hooks/useAppointments";
import { useInsuranceDetails, usePatientContext } from "../hooks/usePatient";
import {
  useEligibilityByPatient,
  useEligibilityByMPI,
  useEligibilityByAppointment,
  useEligibilityHistoryByTaskId,
  useEligibilityTaskStatus,
  type EligibilityHistoryItem,
} from "../hooks/useEligibility";
import type { PatientData, InsuranceData } from "../lib/api-client";
import type { MantysEligibilityResponse } from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";

interface TodaysAppointmentsListProps {
  onRefresh?: () => void;
}

export const TodaysAppointmentsList: React.FC<TodaysAppointmentsListProps> = ({
  onRefresh,
}) => {
  const { user } = useAuth();
  const selectedClinicId = user?.selected_team_id || "";

  const [currentFilters, setCurrentFilters] =
    useState<AppointmentFilters | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Eligibility results drawer/modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showEligibilityResultsDrawer, setShowEligibilityResultsDrawer] =
    useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const today = new Date();
  const todayStr = formatDateForApi(today);

  const {
    data: appointments = [],
    isLoading,
    error,
    refetch,
  } = useAppointmentSearch(
    {
      fromDate: currentFilters?.fromDate || todayStr,
      toDate: currentFilters?.toDate || todayStr,
      customerSiteId: currentFilters?.customerSiteId || 31,
      appStatusId: currentFilters?.appStatusId,
      patientName: currentFilters?.patientName || undefined,
      mpi: currentFilters?.mpi || undefined,
      phoneNumber: currentFilters?.phoneNumber || undefined,
      displayEncounterNumber:
        currentFilters?.displayEncounterNumber || undefined,
      physicianId: currentFilters?.physicianId || undefined,
      visitTypeId: currentFilters?.visitTypeId || undefined,
      specialisationId: currentFilters?.specialisationId || undefined,
      roomId: currentFilters?.roomId || undefined,
      payerId: currentFilters?.payerId || undefined,
      payerTypeId: currentFilters?.payerTypeId || undefined,
      insuranceType: currentFilters?.insuranceType || undefined,
      encounterType: currentFilters?.encounterType,
      visitPurposeId: currentFilters?.visitPurposeId || undefined,
      pageNo: currentFilters?.pageNo || 0,
      recPerPage: currentFilters?.recPerPage || 200,
      isFilterDate: currentFilters?.isFilterDate,
    },
    { enabled: true },
  );

  const { data: patientContext } = usePatientContext(
    {
      appointmentId: selectedAppointment?.appointment_id?.toString(),
      mpi: selectedAppointment?.mpi,
    },
    { enabled: !!selectedAppointment },
  );

  const {
    data: insuranceDetails = [],
    isLoading: isLoadingInsurance,
    error: insuranceError,
  } = useInsuranceDetails(
    {
      patientId: selectedAppointment?.patient_id || 0,
      apntId: selectedAppointment?.appointment_id,
      encounterId: 0,
      customerId: 1,
      primaryInsPolicyId: null,
      siteId: 1,
      isDiscard: 0,
      hasTopUpCard: 0,
    },
    { enabled: !!selectedAppointment?.patient_id },
  );

  const { data: eligibilityByAppointment = [] } = useEligibilityByAppointment(
    selectedAppointment?.appointment_id?.toString() || "",
    !!selectedAppointment?.appointment_id,
  );

  const { data: eligibilityByPatient = [] } = useEligibilityByPatient(
    selectedAppointment?.patient_id?.toString() || "",
    !!selectedAppointment?.patient_id && eligibilityByAppointment.length === 0,
  );

  const { data: eligibilityByMPI = [] } = useEligibilityByMPI(
    selectedAppointment?.mpi || "",
    !!selectedAppointment?.mpi &&
    eligibilityByAppointment.length === 0 &&
    eligibilityByPatient.length === 0,
  );

  const previousSearches = useMemo(() => {
    if (eligibilityByAppointment.length > 0) return eligibilityByAppointment;
    if (eligibilityByPatient.length > 0) return eligibilityByPatient;
    return eligibilityByMPI;
  }, [eligibilityByAppointment, eligibilityByPatient, eligibilityByMPI]);

  // Auto-open results drawer if there's exactly one completed eligibility check today
  const { todaySearches } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayItems: EligibilityHistoryItem[] = [];

    previousSearches.forEach((search) => {
      if (!search.createdAt) return;
      const searchDate = new Date(search.createdAt);
      searchDate.setHours(0, 0, 0, 0);
      if (searchDate.getTime() === todayStart.getTime()) {
        todayItems.push(search);
      }
    });

    return { todaySearches: todayItems };
  }, [previousSearches]);

  // Auto-open effect
  React.useEffect(() => {
    if (
      showDrawer &&
      !showEligibilityResultsDrawer &&
      !showEligibilityModal &&
      !hasAutoOpened &&
      todaySearches.length === 1 &&
      todaySearches[0].status === "complete"
    ) {
      const search = todaySearches[0];
      setSelectedTaskId(search.taskId);
      setShowEligibilityResultsDrawer(true);
      setHasAutoOpened(true);
    }
  }, [
    showDrawer,
    todaySearches,
    showEligibilityResultsDrawer,
    showEligibilityModal,
    hasAutoOpened,
  ]);

  const { data: selectedEligibilityItem } = useEligibilityHistoryByTaskId(
    selectedTaskId || "",
    !!selectedTaskId,
  );

  const { data: freshTaskResult } = useEligibilityTaskStatus(
    selectedTaskId || "",
    {
      enabled: !!selectedTaskId && (showEligibilityResultsDrawer || showEligibilityModal),
      refetchInterval: showEligibilityModal ? 5000 : false,
    },
  );

  // Debug logging
  React.useEffect(() => {
    if (selectedTaskId) {
      console.log("[TodaysAppointmentsList] selectedTaskId:", selectedTaskId);
      console.log(
        "[TodaysAppointmentsList] selectedEligibilityItem:",
        selectedEligibilityItem,
      );
      console.log("[TodaysAppointmentsList] freshTaskResult:", freshTaskResult);
      console.log(
        "[TodaysAppointmentsList] showEligibilityResultsDrawer:",
        showEligibilityResultsDrawer,
      );
    }
  }, [
    selectedTaskId,
    selectedEligibilityItem,
    freshTaskResult,
    showEligibilityResultsDrawer,
  ]);

  // Auto-transition from modal to drawer when results become available
  React.useEffect(() => {
    if (showEligibilityModal && (selectedEligibilityItem || freshTaskResult)) {
      // Check both selectedEligibilityItem.result and freshTaskResult.result
      const itemResult = selectedEligibilityItem?.result as any;
      const freshResult = freshTaskResult?.result as any;
      const result = freshResult || itemResult;

      const hasResult = result && (
        result.status ||
        result.data_dump ||
        result.aggregated_results
      );

      // Also check if the task has completed or failed
      const isComplete = selectedEligibilityItem?.status === "complete" ||
                        selectedEligibilityItem?.status === "error" ||
                        freshTaskResult?.status === "complete" ||
                        freshTaskResult?.status === "error";

      if (hasResult || isComplete) {
        console.log("[TodaysAppointmentsList] Auto-transitioning from modal to drawer", {
          hasResult,
          isComplete,
          itemStatus: selectedEligibilityItem?.status,
          freshStatus: freshTaskResult?.status,
        });
        setShowEligibilityModal(false);
        setShowEligibilityResultsDrawer(true);
      }
    }
  }, [showEligibilityModal, selectedEligibilityItem, freshTaskResult]);

  const emiratesIdFromContext = patientContext?.nationality_id || null;

  const handleSearch = useCallback((filters: AppointmentFilters) => {
    setCurrentFilters(filters);
  }, []);

  const handleClear = useCallback(() => {
    setCurrentFilters(null);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  const handleAppointmentClick = useCallback((appointment: AppointmentData) => {
    setSelectedAppointment(appointment);
    setShowDrawer(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setShowDrawer(false);
    setTimeout(() => {
      setSelectedAppointment(null);
      setHasAutoOpened(false);
    }, 300);
  }, []);

  // Handler for previous search clicks (eligibility history)
  const handlePreviousSearchClick = useCallback(
    (search: EligibilityHistoryItem) => {
      console.log("[handlePreviousSearchClick] Clicked search item:", {
        taskId: search.taskId,
        status: search.status,
        patientName: search.patientName,
        patientMPI: search.patientMPI,
        result: search.result,
        createdAt: search.createdAt,
      });
      const isErrorStatus =
        search.status === "error" || (search.status as string) === "failed";

      // Check if there's a result available (including failed results with detailed status)
      const result = search.result as any;
      const hasResult = result && (
        result.status ||
        result.data_dump ||
        result.aggregated_results
      );

      console.log("[handlePreviousSearchClick] isErrorStatus:", isErrorStatus, "hasResult:", hasResult);
      setSelectedTaskId(search.taskId);

      if (search.status === "complete" || isErrorStatus || hasResult) {
        // Show drawer for completed, error status, or if result is available
        console.log(
          "[handlePreviousSearchClick] Opening eligibility results drawer (status:",
          search.status,
          ", hasResult:",
          hasResult,
          ")",
        );
        // Close modal first if it's open
        setShowEligibilityModal(false);
        setShowEligibilityResultsDrawer(true);
      } else {
        // Pending/processing without result - show modal for live progress
        console.log(
          "[handlePreviousSearchClick] Opening eligibility modal (status:",
          search.status,
          ")",
        );
        // Close drawer first if it's open
        setShowEligibilityResultsDrawer(false);
        setShowEligibilityModal(true);
      }
    },
    [],
  );

  const handleCloseEligibilityResultsDrawer = useCallback(() => {
    setShowEligibilityResultsDrawer(false);
    setTimeout(() => {
      setSelectedTaskId(null);
    }, 300);
  }, []);

  const handleCloseEligibilityModal = useCallback(() => {
    setShowEligibilityModal(false);
    setTimeout(() => {
      setSelectedTaskId(null);
    }, 300);
  }, []);

  const getPatientDataFromAppointment = useCallback(
    (apt: AppointmentData | null): PatientData | null => {
      if (!apt) return null;
      const nameParts = apt.full_name?.split(" ") || [];
      const emiratesId = emiratesIdFromContext || (apt as any).nationality_id;
      return {
        patient_id: apt.patient_id,
        mpi: apt.mpi,
        firstname: nameParts[0] || "",
        middlename: nameParts.slice(1, -1).join(" ") || "",
        lastname: nameParts[nameParts.length - 1] || "",
        dob: apt.dob || "",
        age: apt.age || "",
        gender: apt.gender || "",
        phone: apt.mobile_phone || "",
        email: apt.email || "",
        appointment_id: apt.appointment_id,
        encounter_id: (apt as any).encounter_id,
        uid_value: emiratesId || undefined,
      } as PatientData;
    },
    [emiratesIdFromContext],
  );

  const resultData = useMemo(() => {
    const rawResult =
      freshTaskResult?.result || selectedEligibilityItem?.result;
    if (!rawResult) return null;

    // Check if this is a search-all result
    const searchAllResult = rawResult as any;
    if (
      searchAllResult.is_search_all === true &&
      searchAllResult.aggregated_results &&
      Array.isArray(searchAllResult.aggregated_results)
    ) {
      // Find the eligible result from aggregated_results
      const eligibleEntry = searchAllResult.aggregated_results.find(
        (r: any) => r.status === "found" && r.data?.is_eligible === true,
      );

      if (eligibleEntry && eligibleEntry.data) {
        // Transform to MantysEligibilityResponse format
        return {
          tpa: eligibleEntry.tpa_name || eligibleEntry.data?.payer_id || "",
          data: eligibleEntry.data,
          status: "found" as const,
          job_task_id:
            eligibleEntry.data?.job_task_id || searchAllResult.task_id || "",
          task_id: searchAllResult.task_id,
          aggregated_results: searchAllResult.aggregated_results,
        } as MantysEligibilityResponse & { aggregated_results?: any[] };
      }

      // No eligible result found in search-all - return search-all response with aggregated results
      return {
        tpa: "",
        data: null,
        status: "not_found" as const,
        job_task_id: searchAllResult.task_id || "",
        task_id: searchAllResult.task_id,
        aggregated_results: searchAllResult.aggregated_results,
        is_search_all: true,
      } as MantysEligibilityResponse & { aggregated_results?: any[]; is_search_all?: boolean };
    }

    // Regular (non-search-all) result
    return rawResult as MantysEligibilityResponse;
  }, [freshTaskResult, selectedEligibilityItem]);

  return (
    <>
      <div className="space-y-6">
        <AppointmentsFilterForm
          onSearch={handleSearch}
          onClear={handleClear}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 mr-3"
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
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900">
                  Error Loading Appointments
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : "An error occurred"}
                </p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {!error && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Total Appointments</span>
              <span className="font-semibold text-gray-900 text-lg">
                {appointments.length}
              </span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Date Range</span>
              <span className="font-medium text-gray-900">
                {currentFilters?.fromDate || "Today"} -{" "}
                {currentFilters?.toDate || "Today"}
              </span>
            </div>
          </div>
        )}

        <AppointmentsTable
          appointments={appointments}
          isLoading={isLoading}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

      {/* Main Appointment Details Drawer */}
      <Drawer
        isOpen={showDrawer}
        onClose={handleCloseDrawer}
        title={`Appointment Details${selectedAppointment?.full_name ? ` - ${selectedAppointment.full_name}` : ""}`}
        headerRight={
          selectedAppointment && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Appointment No: {selectedAppointment.appointment_id}
            </span>
          )
        }
        size="xl"
      >
        {selectedAppointment && (
          <EligibilityDrawerContent
            insuranceDetails={insuranceDetails}
            isLoadingInsurance={isLoadingInsurance}
            insuranceError={
              insuranceError instanceof Error ? insuranceError.message : null
            }
            previousSearches={previousSearches}
            patientData={getPatientDataFromAppointment(selectedAppointment)}
            onPreviousSearchClick={handlePreviousSearchClick}
          />
        )}
      </Drawer>

      {/* Eligibility Results Drawer */}
      {showEligibilityResultsDrawer &&
        selectedEligibilityItem && (
          <Drawer
            isOpen={showEligibilityResultsDrawer}
            onClose={handleCloseEligibilityResultsDrawer}
            title={`Eligibility Check Results - ${selectedEligibilityItem?.patientName || selectedAppointment?.full_name || selectedEligibilityItem?.patientId || "Patient"}`}
            headerRight={
              resultData
                ? (() => {
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
                      <Badge
                        className={
                          keyFields.isEligible
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {keyFields.isEligible ? "Eligible" : "Not Eligible"}
                      </Badge>
                    );
                  })()
                : (selectedEligibilityItem?.status === "error" ||
                   (selectedEligibilityItem?.status as string) === "failed")
                  ? <Badge className="bg-red-100 text-red-800">Failed</Badge>
                  : null
            }
            size="xl"
          >
            <div className="p-6">
              <MantysResultsDisplay
                response={resultData || undefined}
                onClose={handleCloseEligibilityResultsDrawer}
                onCheckAnother={handleCloseEligibilityResultsDrawer}
                screenshot={
                  selectedEligibilityItem?.interimResults?.screenshot || null
                }
                patientName={selectedEligibilityItem?.patientName || selectedAppointment?.full_name}
                patientMPI={selectedEligibilityItem?.patientMPI || selectedAppointment?.mpi}
                patientId={
                  selectedAppointment?.patient_id ||
                  (selectedEligibilityItem?.patientId
                    ? parseInt(selectedEligibilityItem.patientId)
                    : undefined)
                }
                appointmentId={selectedEligibilityItem?.appointmentId || selectedAppointment?.appointment_id}
                encounterId={selectedEligibilityItem?.encounterId || (selectedAppointment as any)?.encounter_id}
                physicianId={(() => {
                  // Priority: appointment data > patient context > history
                  const appointmentPhysicianId = (selectedAppointment as any)?.physician_id;
                  if (appointmentPhysicianId) {
                    return typeof appointmentPhysicianId === 'number'
                      ? appointmentPhysicianId
                      : parseInt(String(appointmentPhysicianId), 10);
                  }
                  const physicianIdValue = patientContext?.physician_id || patientContext?.physicianId;
                  if (!physicianIdValue) return undefined;
                  if (typeof physicianIdValue === 'number') return physicianIdValue;
                  const parsed = parseInt(String(physicianIdValue), 10);
                  return isNaN(parsed) ? undefined : parsed;
                })()}
                errorMessage={selectedEligibilityItem?.error || freshTaskResult?.error}
                taskId={selectedTaskId || undefined}
              />
            </div>
          </Drawer>
        )}

      {showEligibilityModal && selectedTaskId && (
        <ExtractionProgressModal
          isOpen={showEligibilityModal}
          onClose={handleCloseEligibilityModal}
          taskId={selectedTaskId}
          viewMode="history"
        />
      )}
    </>
  );
};
