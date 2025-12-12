import React from "react";
import { AppointmentData } from "../lib/api";

interface AppointmentsTableProps {
    appointments: AppointmentData[];
    isLoading: boolean;
    onAppointmentClick: (appointment: AppointmentData) => void;
}

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
    appointments,
    isLoading,
    onAppointmentClick,
}) => {
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No appointments found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search filters.
                </p>
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

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            SI.No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Physician
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Appt Date/Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Visit Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Payer Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Patient Details
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {index + 1}
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
                            <td className="px-4 py-3 text-sm text-gray-900">
                                <div className="max-w-xs">
                                    <p className="font-medium truncate">
                                        {appointment.physician_name || "N/A"}
                                    </p>
                                    {appointment.specialisation_name && (
                                        <p className="text-xs text-gray-500 truncate">
                                            {appointment.specialisation_name}
                                        </p>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                <div>
                                    <p className="font-medium">
                                        {appointment.appointment_date || "N/A"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {appointment.appointment_time || ""}
                                    </p>
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {appointment.visit_type || "N/A"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {appointment.payer_type || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                <div className="max-w-xs">
                                    <p className="font-medium truncate">
                                        {appointment.full_name || "N/A"}
                                    </p>
                                    <p className="text-xs text-gray-500">MPI: {appointment.mpi}</p>
                                    {appointment.age && (
                                        <p className="text-xs text-gray-500">
                                            {appointment.age} | {appointment.gender}
                                        </p>
                                    )}
                                </div>
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

            {/* Summary footer */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                        Showing <span className="font-medium">{appointments.length}</span>{" "}
                        appointment(s)
                    </div>
                    <div className="text-xs text-gray-500">
                        Click on any row to view full details
                    </div>
                </div>
            </div>
        </div>
    );
};

