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

          // Auto-expand active insurance policies
          const activeIds = new Set(
            insurances
              .filter((ins) => ins.insurance_status?.toLowerCase() === "active")
              .map((ins) => ins.patient_insurance_tpa_policy_id),
          );
          setExpandedInsurance(activeIds);
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
            {/* Patient Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">
                Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <p className="text-gray-900">
                    {selectedAppointment.full_name}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">MPI:</span>
                  <p className="text-gray-900">{selectedAppointment.mpi}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Patient ID:</span>
                  <p className="text-gray-900">
                    {selectedAppointment.patient_id}
                  </p>
                </div>
                {selectedAppointment.mobile_phone && (
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <p className="text-gray-900">
                      {selectedAppointment.mobile_phone}
                    </p>
                  </div>
                )}
                {selectedAppointment.email && (
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-900">{selectedAppointment.email}</p>
                  </div>
                )}
                {selectedAppointment.dob && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Date of Birth:
                    </span>
                    <p className="text-gray-900">{selectedAppointment.dob}</p>
                  </div>
                )}
                {selectedAppointment.age && (
                  <div>
                    <span className="font-medium text-gray-700">Age:</span>
                    <p className="text-gray-900">{selectedAppointment.age}</p>
                  </div>
                )}
                {selectedAppointment.gender && (
                  <div>
                    <span className="font-medium text-gray-700">Gender:</span>
                    <p className="text-gray-900">
                      {selectedAppointment.gender}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3">
                Appointment Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">
                    Appointment ID:
                  </span>
                  <p className="text-gray-900">
                    {selectedAppointment.appointment_id}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Date:</span>
                  <p className="text-gray-900">
                    {selectedAppointment.appointment_date}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Time:</span>
                  <p className="text-gray-900">
                    {selectedAppointment.appointment_time}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className="text-gray-900">
                    {selectedAppointment.appointment_status}
                  </p>
                </div>
                {selectedAppointment.physician_name && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Physician:
                    </span>
                    <p className="text-gray-900">
                      {selectedAppointment.physician_name}
                    </p>
                  </div>
                )}
                {selectedAppointment.specialisation_name && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Specialization:
                    </span>
                    <p className="text-gray-900">
                      {selectedAppointment.specialisation_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Insurance Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
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
    </>
  );
};
