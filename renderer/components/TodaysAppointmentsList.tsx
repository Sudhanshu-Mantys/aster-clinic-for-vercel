import React, { useState, useMemo, useCallback } from "react";
import { Drawer } from "./ui/drawer";
import { Badge } from "./ui/badge";
import { InsuranceDetailsSection } from "./InsuranceDetailsSection";
import { AppointmentsFilterForm, AppointmentFilters } from "./AppointmentsFilterForm";
import { AppointmentsTable } from "./AppointmentsTable";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { ExtractionProgressModal } from "./ExtractionProgressModal";
import { useAuth } from "../contexts/AuthContext";
import {
  useTodaysAppointments,
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
  const [expandedInsurance, setExpandedInsurance] = useState<Set<number>>(new Set());
  const [isPreviousSearchesExpanded, setIsPreviousSearchesExpanded] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showEligibilityDrawer, setShowEligibilityDrawer] = useState(false);
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

  const { data: selectedEligibilityItem } = useEligibilityHistoryByTaskId(
    selectedTaskId || "",
    !!selectedTaskId
  );

  const { data: freshTaskResult } = useEligibilityTaskStatus(selectedTaskId || "", {
    enabled: !!selectedTaskId && showEligibilityDrawer,
    refetchInterval: false,
  });

  const emiratesIdFromContext = patientContext?.nationality_id || null;

  const { todaySearches, olderSearches } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayItems: typeof previousSearches = [];
    const olderItems: typeof previousSearches = [];

    previousSearches.forEach((search) => {
      if (!search.createdAt) {
        olderItems.push(search);
        return;
      }
      const searchDate = new Date(search.createdAt);
      searchDate.setHours(0, 0, 0, 0);
      if (searchDate.getTime() === todayStart.getTime()) {
        todayItems.push(search);
      } else {
        olderItems.push(search);
      }
    });

    return { todaySearches: todayItems, olderSearches: olderItems };
  }, [previousSearches]);

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
    setExpandedInsurance(new Set());
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setShowDrawer(false);
    setTimeout(() => {
      setSelectedAppointment(null);
      setExpandedInsurance(new Set());
    }, 300);
  }, []);

  const handlePreviousSearchClick = useCallback((search: any) => {
    setSelectedTaskId(search.taskId);
    if (search.status === "complete" || search.status === "error") {
      setShowEligibilityDrawer(true);
    } else {
      setShowEligibilityModal(true);
    }
  }, []);

  const handleCloseEligibilityDrawer = useCallback(() => {
    setShowEligibilityDrawer(false);
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

  const toggleInsuranceExpanded = useCallback((insuranceId: number) => {
    setExpandedInsurance((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insuranceId)) {
        newSet.delete(insuranceId);
      } else {
        newSet.add(insuranceId);
      }
      return newSet;
    });
  }, []);

  const expandedInsuranceWithDefaults = useMemo(() => {
    if (expandedInsurance.size > 0) return expandedInsurance;
    const activeValidIds = new Set<number>();
    insuranceDetails.forEach((ins, idx) => {
      const key = ins.patient_insurance_tpa_policy_id || idx;
      const isActive = ins.insurance_status?.toLowerCase() === "active";
      const isValid = ins.is_valid === 1;
      if (isActive && isValid) {
        activeValidIds.add(key);
      }
    });
    return activeValidIds;
  }, [insuranceDetails, expandedInsurance]);

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

  const getTPAName = (code: string) => {
    const tpaMap: Record<string, string> = {
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
    return tpaMap[code] || code;
  };

  const getSearchStatusColors = (search: any) => {
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
          <div className="p-6 space-y-6">

            {previousSearches.length > 0 && (
              <div className="mb-4 space-y-4">
                {todaySearches.length > 0 && (
                  <div>
                    <div className="bg-gray-100 px-4 py-2 rounded-t">
                      <h3 className="text-sm font-bold text-gray-900">
                        Eligibility Checks Today ({todaySearches.length})
                      </h3>
                    </div>
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-b p-3 space-y-3">
                      {todaySearches.map((search: any) => {
                        const date = search.createdAt ? new Date(search.createdAt) : null;
                        const timeString =
                          date && !isNaN(date.getTime())
                            ? date.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "";

                        const colors = getSearchStatusColors(search);
                        const tpaCode = search.tpaCode || search.insurancePayer || "";

                        return (
                          <div
                            key={search.taskId}
                            onClick={() => handlePreviousSearchClick(search)}
                            className={`${colors.bgColor} border-2 ${colors.borderColor} rounded-lg p-4 cursor-pointer ${colors.hoverBgColor} transition-colors`}
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
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 mb-1">
                                  Eligibility Verification History
                                </div>
                                {timeString && (
                                  <div className="text-sm text-gray-700 mb-2">
                                    Verified Today at {timeString}
                                  </div>
                                )}
                                <div className="font-bold text-gray-900 text-base mb-2">
                                  {getTPAName(tpaCode)} ({tpaCode})
                                </div>
                                <div className="text-sm text-gray-700">
                                  Status:{" "}
                                  {search.status === "complete"
                                    ? "Active"
                                    : search.status === "error"
                                      ? "failed"
                                      : search.status}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {olderSearches.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsPreviousSearchesExpanded(!isPreviousSearchesExpanded)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 flex items-center gap-2 transition-colors rounded-t"
                    >
                      <svg
                        className={`w-4 h-4 text-gray-700 transition-transform ${isPreviousSearchesExpanded ? "rotate-180" : ""}`}
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
                    {isPreviousSearchesExpanded && (
                      <div className="bg-gray-50 border border-gray-200 border-t-0 rounded-b px-3 py-2 space-y-1">
                        {olderSearches.map((search: any) => {
                          const tpaCode = search.tpaCode || search.insurancePayer || "";
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
                              onClick={() => handlePreviousSearchClick(search)}
                              className="bg-white hover:bg-gray-100 rounded px-3 py-2 text-sm cursor-pointer transition-colors"
                            >
                              <span className="text-gray-900">
                                {formattedDate ? `${formattedDate} - ` : ""}
                                {getTPAName(tpaCode)} ({tpaCode}) - Status:{" "}
                                {search.status === "complete"
                                  ? "Active"
                                  : search.status === "error"
                                    ? "failed"
                                    : search.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-3">
              <InsuranceDetailsSection
                isLoadingInsurance={isLoadingInsurance}
                insuranceError={insuranceError instanceof Error ? insuranceError.message : null}
                insuranceDetails={insuranceDetails}
                expandedInsurance={expandedInsuranceWithDefaults}
                onToggleExpanded={toggleInsuranceExpanded}
                patientData={getPatientDataFromAppointment(selectedAppointment)}
              />
            </div>
          </div>
        )}
      </Drawer>

      {showEligibilityDrawer && selectedEligibilityItem?.status === "complete" && resultData && (
        <Drawer
          isOpen={showEligibilityDrawer}
          onClose={handleCloseEligibilityDrawer}
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
                onClose={handleCloseEligibilityDrawer}
                onCheckAnother={handleCloseEligibilityDrawer}
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

      {showEligibilityModal && selectedTaskId && !resultData && (
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
