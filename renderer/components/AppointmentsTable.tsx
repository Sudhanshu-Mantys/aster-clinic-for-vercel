import React, { useMemo } from "react";
import { useEligibilityHistory } from "../hooks/useEligibility";
import { useAuth } from "../contexts/AuthContext";
import type { AppointmentData } from "../lib/api-client";

interface AppointmentsTableProps {
  appointments: AppointmentData[];
  isLoading: boolean;
  onAppointmentClick: (appointment: AppointmentData) => void;
}

type EligibilityStatus = "success" | "error" | "processing" | null;

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
  appointments,
  isLoading,
  onAppointmentClick,
}) => {
  const { user } = useAuth();
  const clinicId = user?.selected_team_id;

  const { data: historyItems = [] } = useEligibilityHistory(clinicId);

  const eligibilityStatus = useMemo(() => {
    const statusMap: Record<string, EligibilityStatus> = {};

    const validEligibilityChecks = historyItems.filter((item) =>
      ["complete", "error", "pending", "processing"].includes(item.status)
    );

    const mpiChecks: Record<string, { item: (typeof historyItems)[0]; timestamp: number }[]> = {};

    validEligibilityChecks.forEach((item) => {
      const mpi = item.patientMPI;
      if (mpi) {
        if (!mpiChecks[mpi]) {
          mpiChecks[mpi] = [];
        }
        const timestamp = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        mpiChecks[mpi].push({ item, timestamp });
      }
    });

    Object.keys(mpiChecks).forEach((mpi) => {
      const checks = mpiChecks[mpi];
      checks.sort((a, b) => b.timestamp - a.timestamp);
      const mostRecent = checks[0].item;

      if (mostRecent.status === "error") {
        statusMap[mpi] = "error";
      } else if (mostRecent.status === "pending" || mostRecent.status === "processing") {
        statusMap[mpi] = "processing";
      } else if (mostRecent.status === "complete") {
        const resultData = (mostRecent.result as any)?.data;
        if (resultData?.is_eligible === true) {
          statusMap[mpi] = "success";
        } else {
          statusMap[mpi] = "error";
        }
      }
    });

    return statusMap;
  }, [historyItems]);

  const getTPAName = (appointment: AppointmentData): string | null => {
    if ((appointment as any).tpa_name) {
      return (appointment as any).tpa_name;
    }
    if (appointment.receiver_name) {
      return appointment.receiver_name;
    }
    if (appointment.network_name) {
      const networkParts = appointment.network_name.split(" - ");
      if (networkParts.length > 1) {
        const tpaFromNetwork = networkParts[networkParts.length - 1].trim();
        const tpaMap: Record<string, string> = {
          NEXTCARE: "NextCare",
          NAS: "NAS",
          NEURON: "Neuron",
          DAMAN: "Daman",
          MEDNET: "Mednet",
          OMAN: "Oman Insurance",
        };
        return tpaMap[tpaFromNetwork.toUpperCase()] || tpaFromNetwork;
      }
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
        <p className="mt-1 text-sm text-gray-500">Try adjusting your search filters.</p>
      </div>
    );
  }

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
    const statusLower = status.toLowerCase();

    if (statusLower.includes("open") || statusLower.includes("scheduled")) {
      return "bg-blue-100 text-blue-800";
    } else if (statusLower.includes("confirmed") || statusLower.includes("approved")) {
      return "bg-green-100 text-green-800";
    } else if (statusLower.includes("arrived") || statusLower.includes("checked in")) {
      return "bg-indigo-100 text-indigo-800";
    } else if (statusLower.includes("in progress") || statusLower.includes("waiting")) {
      return "bg-yellow-100 text-yellow-800";
    } else if (statusLower.includes("completed")) {
      return "bg-emerald-100 text-emerald-800";
    } else if (statusLower.includes("cancelled") || statusLower.includes("no show")) {
      return "bg-red-100 text-red-800";
    } else if (statusLower.includes("pending") || statusLower.includes("on hold")) {
      return "bg-orange-100 text-orange-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const renderEligibilityIcon = (status: EligibilityStatus, size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "w-5 h-5" : "w-6 h-6";
    const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

    if (!status) {
      return <span className="text-gray-300">—</span>;
    }

    if (status === "success") {
      return (
        <span
          className={`inline-flex items-center justify-center ${sizeClass} rounded-full bg-green-100 text-green-600`}
          title="Eligibility check successful"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    }

    if (status === "processing") {
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-yellow-500 animate-pulse"
          title="Eligibility check in progress"
        />
      );
    }

    return (
      <span
        className={`inline-flex items-center justify-center ${sizeClass} rounded-full bg-red-100 text-red-600`}
        title="Eligibility check failed"
      >
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                SI.No
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Patient Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Appt Date/Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Payer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Physician
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Visit Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Eligibility
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Mobile
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {appointments.map((appointment, index) => (
              <tr
                key={appointment.appointment_id || index}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onAppointmentClick(appointment)}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div className="max-w-xs">
                    <p className="font-medium truncate">{appointment.full_name || "N/A"}</p>
                    <p className="text-xs text-gray-500">MPI: {appointment.mpi}</p>
                    {appointment.age && (
                      <p className="text-xs text-gray-500">
                        {appointment.age} | {appointment.gender}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div>
                    <p className="font-medium">{appointment.appointment_date || "N/A"}</p>
                    <p className="text-xs text-gray-500">{appointment.appointment_time || ""}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div className="max-w-xs flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {(() => {
                        const tpaName = getTPAName(appointment);
                        return (
                          <>
                            <p className="font-medium truncate">
                              {tpaName ||
                                appointment.network_name ||
                                appointment.payer_name ||
                                appointment.payer_type ||
                                "N/A"}
                            </p>
                            {tpaName && appointment.network_name && (
                              <p className="text-xs text-gray-500 truncate">{appointment.network_name}</p>
                            )}
                            {tpaName && appointment.payer_name && (
                              <p className="text-xs text-gray-500 truncate">{appointment.payer_name}</p>
                            )}
                            {appointment.payer_type && (
                              <p className="text-xs text-gray-500 truncate">Type: {appointment.payer_type}</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {eligibilityStatus[appointment.mpi] && (
                      <div className="flex-shrink-0 mt-1">
                        {renderEligibilityIcon(eligibilityStatus[appointment.mpi], "sm")}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div className="max-w-xs">
                    <p className="font-medium truncate">
                      {appointment.provider || appointment.physician_name || "N/A"}
                    </p>
                    {appointment.specialisation_name && (
                      <p className="text-xs text-gray-500 truncate">{appointment.specialisation_name}</p>
                    )}
                    {appointment.physician_id && (
                      <p className="text-xs text-gray-400 truncate">ID: {appointment.physician_id}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      appointment.appointment_status
                    )}`}
                  >
                    {appointment.appointment_status || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {(appointment as any).visit_type || "N/A"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {renderEligibilityIcon(eligibilityStatus[appointment.mpi])}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {appointment.mobile_phone || "N/A"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(appointment);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-3 p-3">
        {appointments.map((appointment, index) => {
          const tpaName = getTPAName(appointment);
          return (
            <div
              key={appointment.appointment_id || index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onAppointmentClick(appointment)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{appointment.full_name || "N/A"}</h3>
                  <p className="text-sm text-gray-500">MPI: {appointment.mpi}</p>
                </div>
                {eligibilityStatus[appointment.mpi] && (
                  <div className="flex-shrink-0">
                    {renderEligibilityIcon(eligibilityStatus[appointment.mpi], "sm")}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Date/Time</p>
                  <p className="font-medium">{appointment.appointment_date || "N/A"}</p>
                  <p className="text-gray-600">{appointment.appointment_time || ""}</p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Status</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      appointment.appointment_status
                    )}`}
                  >
                    {appointment.appointment_status || "Unknown"}
                  </span>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Payer</p>
                  <p className="font-medium truncate">
                    {tpaName ||
                      appointment.network_name ||
                      appointment.payer_name ||
                      appointment.payer_type ||
                      "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Physician</p>
                  <p className="font-medium truncate">
                    {appointment.provider || appointment.physician_name || "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Mobile</p>
                  <p>{appointment.mobile_phone || "N/A"}</p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Visit Type</p>
                  <p>{(appointment as any).visit_type || "N/A"}</p>
                </div>
              </div>

              {appointment.specialisation_name && (
                <p className="mt-2 text-xs text-gray-500">{appointment.specialisation_name}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{appointments.length}</span> appointment(s)
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">Click on any row to view full details</div>
        </div>
      </div>
    </div>
  );
};
