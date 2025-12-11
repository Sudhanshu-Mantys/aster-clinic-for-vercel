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

interface TodaysAppointmentsListProps {
  onRefresh?: () => void;
}

export const TodaysAppointmentsList: React.FC<TodaysAppointmentsListProps> = ({
  onRefresh,
}) => {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [insuranceDetails, setInsuranceDetails] = useState<InsuranceData[]>([]);
  const [isLoadingInsurance, setIsLoadingInsurance] = useState(false);
  const [insuranceError, setInsuranceError] = useState<string | null>(null);
  const [expandedInsurance, setExpandedInsurance] = useState<Set<number>>(
    new Set(),
  );
  const [showDrawer, setShowDrawer] = useState(false);

  const fetchTodaysAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/appointments/today");
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
    fetchTodaysAppointments();
  }, []);

  const handleRefresh = () => {
    fetchTodaysAppointments();
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

  // Filter appointments based on search term
  const filteredAppointments = appointments.filter((apt) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      apt.full_name?.toLowerCase().includes(searchLower) ||
      apt.mpi?.toLowerCase().includes(searchLower) ||
      apt.mobile_phone?.includes(searchTerm) ||
      apt.physician_name?.toLowerCase().includes(searchLower) ||
      apt.appointment_status?.toLowerCase().includes(searchLower)
    );
  });

  // Group appointments by status for better organization
  const groupedAppointments = filteredAppointments.reduce(
    (acc, apt) => {
      const status = apt.appointment_status || "Unknown";
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(apt);
      return acc;
    },
    {} as Record<string, AppointmentData[]>,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading today's appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with search and refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, MPI, phone, physician, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Appointments</CardDescription>
              <CardTitle className="text-3xl">{appointments.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Showing</CardDescription>
              <CardTitle className="text-3xl">
                {filteredAppointments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Status Groups</CardDescription>
              <CardTitle className="text-3xl">
                {Object.keys(groupedAppointments).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Last Updated</CardDescription>
              <CardTitle className="text-lg">
                {new Date().toLocaleTimeString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Appointments list */}
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No appointments found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm
                ? "Try adjusting your search terms."
                : "No appointments scheduled for today."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAppointments).map(([status, appts]) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {status}
                  </h3>
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                    {appts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {appts.map((apt) => (
                    <Card
                      key={apt.appointment_id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleAppointmentClick(apt)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Patient Info */}
                            <div>
                              <p className="font-semibold text-gray-900">
                                {apt.full_name}
                              </p>
                              <div className="mt-1 space-y-0.5">
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">MPI:</span>{" "}
                                  {apt.mpi}
                                </p>
                                {apt.mobile_phone && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Phone:</span>{" "}
                                    {apt.mobile_phone}
                                  </p>
                                )}
                                {apt.age && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Age:</span>{" "}
                                    {apt.age} | {apt.gender}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Appointment Info */}
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                Appointment Details
                              </p>
                              <div className="mt-1 space-y-0.5">
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Time:</span>{" "}
                                  {apt.appointment_time}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">ID:</span>{" "}
                                  {apt.appointment_id}
                                </p>
                                {apt.specialisation_name && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">
                                      Specialization:
                                    </span>{" "}
                                    {apt.specialisation_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Physician Info */}
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                Physician
                              </p>
                              <p className="text-sm text-gray-900 mt-1">
                                {apt.physician_name}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="ml-4 flex flex-col items-end gap-2">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                apt.appointment_status
                                  ?.toLowerCase()
                                  .includes("confirmed")
                                  ? "bg-green-100 text-green-800"
                                  : apt.appointment_status
                                        ?.toLowerCase()
                                        .includes("pending")
                                    ? "bg-yellow-100 text-yellow-800"
                                    : apt.appointment_status
                                          ?.toLowerCase()
                                          .includes("cancelled")
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {apt.appointment_status}
                            </span>
                            <span className="text-xs text-gray-500">
                              Click for details
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
