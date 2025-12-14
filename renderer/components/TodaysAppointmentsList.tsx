import React, { useState, useEffect } from "react";
import {
  AppointmentData,
  PatientData,
  InsuranceData,
  getInsuranceDetails,
} from "../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Drawer } from "./ui/drawer";
import { InsuranceDetailsSection } from "./InsuranceDetailsSection";
import {
  AppointmentsFilterForm,
  AppointmentFilters,
} from "./AppointmentsFilterForm";
import { AppointmentsTable } from "./AppointmentsTable";
import { EligibilityCheckMetadata } from "../lib/redis-eligibility-mapping";
import { EligibilityHistoryService, EligibilityHistoryItem } from "../utils/eligibilityHistory";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import { ExtractionProgressModal } from "./ExtractionProgressModal";

interface TodaysAppointmentsListProps {
  onRefresh?: () => void;
}

export const TodaysAppointmentsList: React.FC<TodaysAppointmentsListProps> = ({
  onRefresh,
}) => {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [insuranceDetails, setInsuranceDetails] = useState<InsuranceData[]>([]);
  const [isLoadingInsurance, setIsLoadingInsurance] = useState(false);
  const [insuranceError, setInsuranceError] = useState<string | null>(null);
  const [expandedInsurance, setExpandedInsurance] = useState<Set<number>>(
    new Set(),
  );
  const [showDrawer, setShowDrawer] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<AppointmentFilters | null>(null);
  const [previousSearches, setPreviousSearches] = useState<EligibilityCheckMetadata[]>([]);
  const [loadingPreviousSearches, setLoadingPreviousSearches] = useState(false);
  const [selectedEligibilityItem, setSelectedEligibilityItem] = useState<EligibilityHistoryItem | null>(null);
  const [showEligibilityDrawer, setShowEligibilityDrawer] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [loadingEligibilityItem, setLoadingEligibilityItem] = useState(false);
  const [freshEligibilityResult, setFreshEligibilityResult] = useState<any>(null);
  const [isPreviousSearchesExpanded, setIsPreviousSearchesExpanded] = useState(false);
  const [todaySearchesResults, setTodaySearchesResults] = useState<Record<string, { copay?: string; deductible?: string }>>({});

  const fetchAppointments = async (filters?: AppointmentFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = "/api/appointments/today";

      // If filters are provided, add them as query parameters
      if (filters) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== "") {
            params.append(key, String(value));
          }
        });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch appointments");
      }

      setAppointments(data.body?.Data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleSearch = (filters: AppointmentFilters) => {
    setCurrentFilters(filters);
    fetchAppointments(filters);
  };

  const handleClear = () => {
    setCurrentFilters(null);
    fetchAppointments();
  };

  const handleRefresh = () => {
    fetchAppointments(currentFilters || undefined);
    onRefresh?.();
  };

  const handleAppointmentClick = async (appointment: AppointmentData) => {
    setSelectedAppointment(appointment);
    setShowDrawer(true);
    setInsuranceDetails([]);
    setInsuranceError(null);
    setExpandedInsurance(new Set());
    setPreviousSearches([]);

    // Fetch insurance details for the patient
    if (appointment.patient_id) {
      setIsLoadingInsurance(true);
      try {
        const response = await getInsuranceDetails({
          patientId: appointment.patient_id,
          apntId: appointment.appointment_id,
          encounterId: 0,
          customerId: 1,
          primaryInsPolicyId: null,
          siteId: 1,
          isDiscard: 0,
          hasTopUpCard: 0,
        });

        if (response && response.body && response.body.Data) {
          const insurances = response.body.Data;
          setInsuranceDetails(insurances);

          // Auto-expand active and valid insurance policies, keep expired collapsed
          const activeValidIds = new Set<number>();
          insurances.forEach((ins, idx) => {
            const key = ins.patient_insurance_tpa_policy_id || idx;
            const isActive = ins.insurance_status?.toLowerCase() === "active";
            const isValid = ins.is_valid === 1;
            // Only expand if active AND valid
            if (isActive && isValid) {
              activeValidIds.add(key);
            }
          });
          setExpandedInsurance(activeValidIds);
        } else {
          setInsuranceDetails([]);
        }
      } catch (err) {
        console.error("Insurance fetch error:", err);
        setInsuranceError(
          err instanceof Error
            ? err.message
            : "Failed to fetch insurance details",
        );
      } finally {
        setIsLoadingInsurance(false);
      }
    }

    // Fetch previous eligibility searches
    const fetchPreviousSearches = async () => {
      const patientId = appointment.patient_id;
      const mpi = appointment.mpi;

      if (!patientId && !mpi) {
        setPreviousSearches([]);
        return;
      }

      setLoadingPreviousSearches(true);
      try {
        let searches: EligibilityCheckMetadata[] = [];

        // Try by patientId first
        if (patientId) {
          const response = await fetch(`/api/eligibility/get-by-patient-id?patientId=${patientId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              searches = data.data;
            }
          }
        }

        // If no results and we have mpi, try by mpi
        if (searches.length === 0 && mpi) {
          const response = await fetch(`/api/eligibility/get-by-mpi?mpi=${mpi}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              searches = data.data;
            }
          }
        }

        setPreviousSearches(searches);

        // Fetch eligibility results for today's searches to get copay/deductible
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySearches = searches.filter((search) => {
          if (!search.createdAt) return false;
          const searchDate = new Date(search.createdAt);
          searchDate.setHours(0, 0, 0, 0);
          return searchDate.getTime() === today.getTime() && search.status === "complete";
        });

        // Fetch results for today's searches
        const resultsMap: Record<string, { copay?: string; deductible?: string }> = {};
        for (const search of todaySearches) {
          try {
            const historyItem = await EligibilityHistoryService.getByTaskId(search.taskId);
            if (historyItem?.result?.data) {
              const data = historyItem.result.data;
              // Extract copay and deductible from the first copay detail
              const copayDetail = data.copay_details_to_fill?.[0];
              if (copayDetail?.values_to_fill) {
                const values = copayDetail.values_to_fill;
                // Try to find copay percentage (usually in MEDICINES or CONSULTATION)
                const medicineCopay = values.MEDICINES?.copay;
                const consultationCopay = values.CONSULTATION?.copay;
                const copayValue = medicineCopay || consultationCopay || "0";

                // Try to find deductible
                const medicineDeductible = values.MEDICINES?._maxDeductible || values.MEDICINES?.deductible;
                const consultationDeductible = values.CONSULTATION?._maxDeductible || values.CONSULTATION?.deductible;
                const deductibleValue = medicineDeductible || consultationDeductible || "0";

                resultsMap[search.taskId] = {
                  copay: copayValue,
                  deductible: deductibleValue,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching result for task ${search.taskId}:`, error);
          }
        }
        setTodaySearchesResults(resultsMap);
      } catch (error) {
        console.error("Error fetching previous searches:", error);
        setPreviousSearches([]);
      } finally {
        setLoadingPreviousSearches(false);
      }
    };

    fetchPreviousSearches();
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setTimeout(() => {
      setSelectedAppointment(null);
      setInsuranceDetails([]);
      setInsuranceError(null);
      setExpandedInsurance(new Set());
    }, 300);
  };

  const handlePreviousSearchClick = async (search: EligibilityCheckMetadata) => {
    setLoadingEligibilityItem(true);
    setFreshEligibilityResult(null);

    try {
      // Fetch the eligibility history item by taskId
      const historyItem = await EligibilityHistoryService.getByTaskId(search.taskId);

      if (historyItem) {
        setSelectedEligibilityItem(historyItem);

        // Use drawer for completed checks, modal for active checks
        if (historyItem.status === "complete" && historyItem.result) {
          // Try to fetch fresh result from API
          try {
            const response = await fetch('/api/mantys/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ task_id: search.taskId }),
            });

            if (response.ok) {
              const apiResponse = await response.json();
              if (apiResponse.status === 'complete' && apiResponse.result) {
                if (apiResponse.result.data) {
                  setFreshEligibilityResult(apiResponse.result);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching fresh result:', error);
          }

          setShowEligibilityDrawer(true);
        } else {
          setShowEligibilityModal(true);
        }
      } else {
        // If not found in history, try to fetch from API directly
        if (search.status === "complete") {
          try {
            const response = await fetch('/api/mantys/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ task_id: search.taskId }),
            });

            if (response.ok) {
              const apiResponse = await response.json();
              if (apiResponse.status === 'complete' && apiResponse.result) {
                // Create a synthetic history item
                const syntheticItem: EligibilityHistoryItem = {
                  id: search.taskId,
                  taskId: search.taskId,
                  patientId: search.patientId.toString(),
                  patientName: search.patientName,
                  patientMPI: search.mpi,
                  status: "complete",
                  createdAt: search.createdAt,
                  completedAt: search.completedAt,
                  result: apiResponse.result,
                };
                setSelectedEligibilityItem(syntheticItem);
                setFreshEligibilityResult(apiResponse.result);
                setShowEligibilityDrawer(true);
              }
            }
          } catch (error) {
            console.error('Error fetching eligibility result:', error);
            alert('Could not load eligibility check details. It may have expired or been deleted.');
          }
        } else {
          alert('This eligibility check is still in progress or not available.');
        }
      }
    } catch (error) {
      console.error('Error loading eligibility item:', error);
      alert('Error loading eligibility check details.');
    } finally {
      setLoadingEligibilityItem(false);
    }
  };

  const handleCloseEligibilityDrawer = () => {
    setShowEligibilityDrawer(false);
    setTimeout(() => {
      setSelectedEligibilityItem(null);
      setFreshEligibilityResult(null);
    }, 300);
  };

  const handleCloseEligibilityModal = () => {
    setShowEligibilityModal(false);
    setTimeout(() => {
      setSelectedEligibilityItem(null);
    }, 300);
  };

  const toggleInsuranceExpanded = (insuranceId: number) => {
    setExpandedInsurance((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insuranceId)) {
        newSet.delete(insuranceId);
      } else {
        newSet.add(insuranceId);
      }
      return newSet;
    });
  };

  // Convert AppointmentData to PatientData format for InsuranceDetailsSection
  const getPatientDataFromAppointment = (
    apt: AppointmentData | null,
  ): PatientData | null => {
    if (!apt) return null;

    // Create a minimal PatientData object from appointment data
    const nameParts = apt.full_name?.split(" ") || [];
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
      encounter_id: (apt as any).encounter_id, // May be in the data
    } as PatientData;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Filter Form */}
        <AppointmentsFilterForm
          onSearch={handleSearch}
          onClear={handleClear}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />

        {/* Error Display */}
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
                <p className="text-sm text-red-700 mt-1">{error}</p>
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

        {/* Summary Stats - Compact */}
        {!error && (
          <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Total Appointments</span>
              <span className="font-semibold text-gray-900 text-lg">{appointments.length}</span>
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Date Range</span>
              <span className="font-medium text-gray-900">
                {currentFilters?.fromDate || "Today"} -{" "}
                {currentFilters?.toDate || "Today"}
              </span>
            </div>
          </div>
        )}

        {/* Appointments Table */}
        <AppointmentsTable
          appointments={appointments}
          isLoading={isLoading}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

      {/* Drawer for appointment details and insurance */}
      <Drawer
        isOpen={showDrawer}
        onClose={handleCloseDrawer}
        title={
          selectedAppointment
            ? `${selectedAppointment.full_name} - Appointment Details`
            : "Appointment Details"
        }
        size="xl"
      >
        {selectedAppointment && (
          <div className="p-6 space-y-6">
            {/* Patient & Appointment Information */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                Patient Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-900">
                    {selectedAppointment.full_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">MPI:</span>
                  <span className="text-gray-900">{selectedAppointment.mpi}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">Patient ID:</span>
                  <span className="text-gray-900">
                    {selectedAppointment.patient_id}
                  </span>
                </div>
                {selectedAppointment.mobile_phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="text-gray-900">
                      {selectedAppointment.mobile_phone}
                    </span>
                  </div>
                )}
                {selectedAppointment.email && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">Email:</span>
                    <span className="text-gray-900">{selectedAppointment.email}</span>
                  </div>
                )}
                {selectedAppointment.dob && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">
                      Date of Birth:
                    </span>
                    <span className="text-gray-900">{selectedAppointment.dob}</span>
                  </div>
                )}
                {selectedAppointment.age && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">Age:</span>
                    <span className="text-gray-900">{selectedAppointment.age}</span>
                  </div>
                )}
                {selectedAppointment.gender && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">Gender:</span>
                    <span className="text-gray-900">
                      {selectedAppointment.gender}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">
                    Appointment ID:
                  </span>
                  <span className="text-gray-900">
                    {selectedAppointment.appointment_id}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">Date:</span>
                  <span className="text-gray-900">
                    {selectedAppointment.appointment_date}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">Time:</span>
                  <span className="text-gray-900">
                    {selectedAppointment.appointment_time}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="text-gray-900">
                    {selectedAppointment.appointment_status}
                  </span>
                </div>
                {selectedAppointment.physician_name && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">
                      Physician:
                    </span>
                    <span className="text-gray-900">
                      {selectedAppointment.physician_name}
                    </span>
                  </div>
                )}
                {selectedAppointment.specialisation_name && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">
                      Specialization:
                    </span>
                    <span className="text-gray-900">
                      {selectedAppointment.specialisation_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Previous Eligibility Searches */}
            {loadingPreviousSearches ? (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg px-4 py-3 shadow-sm">
                <p className="text-sm text-blue-700 font-medium">Loading previous searches...</p>
              </div>
            ) : previousSearches.length > 0 ? (() => {
              // Separate today's searches from older ones
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const todaySearches = previousSearches.filter((search) => {
                if (!search.createdAt) return false;
                const searchDate = new Date(search.createdAt);
                searchDate.setHours(0, 0, 0, 0);
                return searchDate.getTime() === today.getTime();
              });

              const olderSearches = previousSearches.filter((search) => {
                if (!search.createdAt) return true;
                const searchDate = new Date(search.createdAt);
                searchDate.setHours(0, 0, 0, 0);
                return searchDate.getTime() < today.getTime();
              });

              return (
                <div className="mb-4 space-y-4">
                  {/* Eligibility Checks Today Section */}
                  {todaySearches.length > 0 && (
                    <div>
                      <div className="bg-green-100 px-4 py-2 rounded-t">
                        <h3 className="text-sm font-bold text-gray-900">
                          ✓ Eligibility Checks Today ({todaySearches.length})
                        </h3>
                      </div>
                      <div className="bg-green-50 border-2 border-green-200 rounded-b p-3 space-y-3">
                        {todaySearches.map((search) => {
                          const date = search.createdAt ? new Date(search.createdAt) : null;
                          const timeString = date && !isNaN(date.getTime())
                            ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                            : '';

                          // Get TPA name from code (you may want to create a mapping)
                          const getTPAName = (code: string) => {
                            const tpaMap: Record<string, string> = {
                              'INS010': 'AXA INSURANCE - GULF',
                              'TPA001': 'Neuron',
                              'TPA002': 'NextCare',
                              'TPA003': 'Al Madallah',
                              'TPA004': 'NAS',
                              'TPA010': 'FMC (First Med)',
                              'TPA023': 'Daman Thiqa',
                              'TPA036': 'Mednet',
                              'TPA037': 'Lifeline',
                              'INS026': 'Daman',
                              'INS017': 'ADNIC',
                            };
                            return tpaMap[code] || code;
                          };

                          return (
                            <div
                              key={search.taskId}
                              onClick={() => handlePreviousSearchClick(search)}
                              className="bg-green-50 border-2 border-green-300 rounded-lg p-4 cursor-pointer hover:bg-green-100 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
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
                                      d="M5 13l4 4L19 7"
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
                                    {getTPAName(search.tpaCode)} ({search.tpaCode})
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    Status: {search.status === "complete" ? "Active" : search.status}
                                    {search.status === "complete" && (() => {
                                      const result = todaySearchesResults[search.taskId];
                                      const copay = result?.copay ? `${result.copay}%` : "30%";
                                      const deductible = result?.deductible || "20.00";
                                      return ` • Copay: ${copay} • Deductible: ${deductible}`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Previous Checks Section (Older Searches) */}
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
                          {olderSearches.map((search) => {
                            if (!search.createdAt) {
                              return (
                                <div
                                  key={search.taskId}
                                  onClick={() => handlePreviousSearchClick(search)}
                                  className="bg-white hover:bg-gray-100 rounded px-3 py-2 text-sm cursor-pointer transition-colors"
                                >
                                  <span className="text-gray-900">
                                    {search.tpaCode}
                                    {search.status === "complete" ? " - Status: Active" : ` - Status: ${search.status}`}
                                  </span>
                                </div>
                              );
                            }
                            const date = new Date(search.createdAt);
                            if (isNaN(date.getTime())) {
                              return (
                                <div
                                  key={search.taskId}
                                  onClick={() => handlePreviousSearchClick(search)}
                                  className="bg-white hover:bg-gray-100 rounded px-3 py-2 text-sm cursor-pointer transition-colors"
                                >
                                  <span className="text-gray-900">
                                    {search.tpaCode}
                                    {search.status === "complete" ? " - Status: Active" : ` - Status: ${search.status}`}
                                  </span>
                                </div>
                              );
                            }
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            const formattedDate = `${day}/${month}/${year}`;

                            // Get TPA name
                            const getTPAName = (code: string) => {
                              const tpaMap: Record<string, string> = {
                                'INS010': 'AXA INSURANCE - GULF',
                                'TPA001': 'Neuron',
                                'TPA002': 'NextCare',
                                'TPA003': 'Al Madallah',
                                'TPA004': 'NAS',
                                'TPA010': 'FMC (First Med)',
                                'TPA023': 'Daman Thiqa',
                                'TPA036': 'Mednet',
                                'TPA037': 'Lifeline',
                                'INS026': 'Daman',
                                'INS017': 'ADNIC',
                              };
                              return tpaMap[code] || code;
                            };

                            return (
                              <div
                                key={search.taskId}
                                onClick={() => handlePreviousSearchClick(search)}
                                className="bg-white hover:bg-gray-100 rounded px-3 py-2 text-sm cursor-pointer transition-colors"
                              >
                                <span className="text-gray-900">
                                  {formattedDate} - {getTPAName(search.tpaCode)} ({search.tpaCode}) - Status: {search.status === "complete" ? "Active" : search.status}
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
            })() : null}

            {/* Insurance Details */}
            <div className="border border-gray-200 rounded-lg p-3">
              <InsuranceDetailsSection
                isLoadingInsurance={isLoadingInsurance}
                insuranceError={insuranceError}
                insuranceDetails={insuranceDetails}
                expandedInsurance={expandedInsurance}
                onToggleExpanded={toggleInsuranceExpanded}
                patientData={getPatientDataFromAppointment(selectedAppointment)}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer for completed eligibility check results */}
      {showEligibilityDrawer && selectedEligibilityItem?.status === "complete" && (
        <Drawer
          isOpen={showEligibilityDrawer}
          onClose={handleCloseEligibilityDrawer}
          title={`Eligibility Check Results - ${selectedEligibilityItem.patientName || selectedEligibilityItem.patientId}`}
          size="xl"
        >
          <div className="p-6">
            {loadingEligibilityItem ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading results...</p>
                </div>
              </div>
            ) : freshEligibilityResult ? (
              <MantysResultsDisplay
                response={freshEligibilityResult}
                onClose={handleCloseEligibilityDrawer}
                onCheckAnother={handleCloseEligibilityDrawer}
                screenshot={selectedEligibilityItem.interimResults?.screenshot || null}
                patientMPI={selectedEligibilityItem.patientMPI}
                patientId={selectedEligibilityItem.patientId ? parseInt(selectedEligibilityItem.patientId) : undefined}
                appointmentId={selectedEligibilityItem.appointmentId}
                encounterId={selectedEligibilityItem.encounterId}
              />
            ) : selectedEligibilityItem?.result ? (
              <MantysResultsDisplay
                response={selectedEligibilityItem.result}
                onClose={handleCloseEligibilityDrawer}
                onCheckAnother={handleCloseEligibilityDrawer}
                screenshot={selectedEligibilityItem.interimResults?.screenshot || null}
                patientMPI={selectedEligibilityItem.patientMPI}
                patientId={selectedEligibilityItem.patientId ? parseInt(selectedEligibilityItem.patientId) : undefined}
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

      {/* Modal for pending/processing/error eligibility checks */}
      {showEligibilityModal && selectedEligibilityItem && (
        <ExtractionProgressModal
          isOpen={showEligibilityModal}
          onClose={handleCloseEligibilityModal}
          status={
            selectedEligibilityItem.status === "error" ? "complete" : selectedEligibilityItem.status
          }
          statusMessage={
            selectedEligibilityItem.status === "pending"
              ? "Navigating Insurance Portal..."
              : selectedEligibilityItem.status === "processing"
                ? "Extracting eligibility data from TPA portal..."
                : selectedEligibilityItem.status === "complete"
                  ? "Eligibility check complete!"
                  : "Check Failed"
          }
          interimScreenshot={selectedEligibilityItem.interimResults?.screenshot || null}
          interimDocuments={
            selectedEligibilityItem.interimResults?.documents?.map((doc) => ({
              id: doc.name,
              tag: doc.type,
              url: doc.url,
            })) || []
          }
          pollingAttempts={selectedEligibilityItem.pollingAttempts || 0}
          maxAttempts={150}
          viewMode="history"
          errorMessage={
            selectedEligibilityItem.status === "error" ? selectedEligibilityItem.error : null
          }
        />
      )}
    </>
  );
};
