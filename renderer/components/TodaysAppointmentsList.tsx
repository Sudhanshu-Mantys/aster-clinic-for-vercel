import React, { useState, useMemo, useCallback } from "react";
import { Drawer } from "./ui/drawer";
import { Badge } from "./ui/badge";
import { EligibilityDrawerContent } from "./EligibilityDrawerContent";
import { MantysEligibilityForm } from "./MantysEligibilityForm";
import { AppointmentsFilterForm, AppointmentFilters } from "./AppointmentsFilterForm";
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

  const [currentFilters, setCurrentFilters] = useState<AppointmentFilters | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Eligibility results drawer/modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showEligibilityResultsDrawer, setShowEligibilityResultsDrawer] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);

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
      displayEncounterNumber: currentFilters?.displayEncounterNumber || undefined,
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
    { enabled: true }
  );

  const { data: patientContext } = usePatientContext(
    {
      appointmentId: selectedAppointment?.appointment_id?.toString(),
      mpi: selectedAppointment?.mpi,
    },
    { enabled: !!selectedAppointment }
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
    { enabled: !!selectedAppointment?.patient_id }
  );

  const { data: eligibilityByPatient = [] } = useEligibilityByPatient(
    selectedAppointment?.patient_id?.toString() || "",
    !!selectedAppointment?.patient_id
  );

  const { data: eligibilityByMPI = [] } = useEligibilityByMPI(
    selectedAppointment?.mpi || "",
    !!selectedAppointment?.mpi && eligibilityByPatient.length === 0
  );

  const previousSearches = useMemo(() => {
    if (eligibilityByPatient.length > 0) return eligibilityByPatient;
    return eligibilityByMPI;
  }, [eligibilityByPatient, eligibilityByMPI]);

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
      todaySearches.length === 1 &&
      todaySearches[0].status === "complete"
    ) {
      const search = todaySearches[0];
      setSelectedTaskId(search.taskId);
      setShowEligibilityResultsDrawer(true);
    }
  }, [showDrawer, todaySearches, showEligibilityResultsDrawer, showEligibilityModal]);

  const { data: selectedEligibilityItem } = useEligibilityHistoryByTaskId(
    selectedTaskId || "",
    !!selectedTaskId
  );

  const { data: freshTaskResult } = useEligibilityTaskStatus(selectedTaskId || "", {
    enabled: !!selectedTaskId && showEligibilityResultsDrawer,
    refetchInterval: false,
  });

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
    }, 300);
  }, []);

  // Handler for previous search clicks (eligibility history)
  const handlePreviousSearchClick = useCallback((search: EligibilityHistoryItem) => {
    const isErrorStatus = search.status === "error" || (search.status as string) === "failed";
    setSelectedTaskId(search.taskId);
    if (isErrorStatus) {
      setShowEligibilityModal(true);
    } else if (search.status === "complete") {
      setShowEligibilityResultsDrawer(true);
    } else {
      setShowEligibilityModal(true);
    }
  }, []);

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
    [emiratesIdFromContext]
  );

  const resultData = useMemo(() => {
    if (freshTaskResult?.result) return freshTaskResult.result as MantysEligibilityResponse;
    if (selectedEligibilityItem?.result)
      return selectedEligibilityItem.result as MantysEligibilityResponse;
    return null;
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
                <h4 className="text-sm font-medium text-red-900">Error Loading Appointments</h4>
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
              <span className="font-semibold text-gray-900 text-lg">{appointments.length}</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Date Range</span>
              <span className="font-medium text-gray-900">
                {currentFilters?.fromDate || "Today"} - {currentFilters?.toDate || "Today"}
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
        title="Appointment Details"
        headerRight={
          selectedAppointment && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{selectedAppointment.appointment_id}
            </span>
          )
        }
        size="xl"
      >
        {selectedAppointment && (
          <EligibilityDrawerContent
            insuranceDetails={insuranceDetails}
            isLoadingInsurance={isLoadingInsurance}
            insuranceError={insuranceError instanceof Error ? insuranceError.message : null}
            previousSearches={previousSearches}
            patientData={getPatientDataFromAppointment(selectedAppointment)}
            onPreviousSearchClick={handlePreviousSearchClick}
          />
        )}
      </Drawer>

      {/* Eligibility Results Drawer */}
      {showEligibilityResultsDrawer && selectedEligibilityItem?.status === "complete" && resultData && (
        <Drawer
          isOpen={showEligibilityResultsDrawer}
          onClose={handleCloseEligibilityResultsDrawer}
          title={`Eligibility Check Results - ${selectedEligibilityItem.patientName || selectedEligibilityItem.patientId}`}
          headerRight={
            resultData ? (
              (() => {
                const keyFields = extractMantysKeyFields(resultData);
                return (
                  <Badge className={keyFields.isEligible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {keyFields.isEligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                );
              })()
            ) : null
          }
          size="xl"
        >
          <div className="p-6">
            {resultData ? (
              <MantysResultsDisplay
                response={resultData}
                onClose={handleCloseEligibilityResultsDrawer}
                onCheckAnother={handleCloseEligibilityResultsDrawer}
                screenshot={selectedEligibilityItem.interimResults?.screenshot || null}
                patientMPI={selectedEligibilityItem.patientMPI}
                patientId={
                  selectedEligibilityItem.patientId
                    ? parseInt(selectedEligibilityItem.patientId)
                    : undefined
                }
                appointmentId={selectedEligibilityItem.appointmentId}
                encounterId={selectedEligibilityItem.encounterId}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No results available</p>
              </div>
            )}
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
