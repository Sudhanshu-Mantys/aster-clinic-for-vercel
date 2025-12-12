import React, { useState, useEffect } from "react";
import { AppointmentData } from "../lib/api";

interface AppointmentsTableProps {
    appointments: AppointmentData[];
    isLoading: boolean;
    onAppointmentClick: (appointment: AppointmentData) => void;
}

interface EligibilityStatus {
    [mpi: string]: 'success' | 'error' | 'processing' | null; // success = green, error = red, processing = yellow, null = no check
}

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
    appointments,
    isLoading,
    onAppointmentClick,
}) => {
    const [eligibilityStatus, setEligibilityStatus] = useState<EligibilityStatus>({});

    // Check eligibility status for all appointments
    useEffect(() => {
        const checkEligibilityStatus = async () => {
            if (appointments.length === 0) return;

            const statusMap: EligibilityStatus = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            try {
                // Fetch eligibility history
                const response = await fetch('/api/eligibility-history');
                if (!response.ok) return;

                const historyItems = await response.json();

                // Filter for today's eligibility checks (complete, error, pending, processing)
                const todayEligibilityChecks = historyItems.filter((item: any) => {
                    // Must be complete, error, pending, or processing status
                    if (!['complete', 'error', 'pending', 'processing'].includes(item.status)) return false;

                    // Check if created today
                    const createdAt = new Date(item.createdAt);
                    createdAt.setHours(0, 0, 0, 0);
                    if (createdAt.getTime() !== today.getTime()) return false;

                    return true;
                });

                // Map MPI to eligibility status with priority: success > processing > error
                // First pass: collect all statuses for each MPI
                const mpiStatuses: { [mpi: string]: Set<'success' | 'error' | 'processing'> } = {};

                todayEligibilityChecks.forEach((item: any) => {
                    if (item.patientMPI) {
                        const mpi = item.patientMPI;
                        if (!mpiStatuses[mpi]) {
                            mpiStatuses[mpi] = new Set();
                        }

                        // Determine this item's status
                        if (item.status === 'error') {
                            mpiStatuses[mpi].add('error');
                        } else if (item.status === 'pending' || item.status === 'processing') {
                            mpiStatuses[mpi].add('processing');
                        } else if (item.status === 'complete') {
                            if (item.result && item.result.data) {
                                const resultData = item.result.data;
                                if (resultData.is_eligible === true) {
                                    mpiStatuses[mpi].add('success');
                                } else {
                                    mpiStatuses[mpi].add('error');
                                }
                            } else {
                                mpiStatuses[mpi].add('error');
                            }
                        }
                    }
                });

                // Second pass: apply priority (success > processing > error)
                Object.keys(mpiStatuses).forEach((mpi) => {
                    const statuses = mpiStatuses[mpi];
                    if (statuses.has('success')) {
                        statusMap[mpi] = 'success';
                    } else if (statuses.has('processing')) {
                        statusMap[mpi] = 'processing';
                    } else if (statuses.has('error')) {
                        statusMap[mpi] = 'error';
                    }
                });

                setEligibilityStatus(statusMap);
            } catch (error) {
                console.error('Error checking eligibility status:', error);
            }
        };

        checkEligibilityStatus();

        // Refresh eligibility status every 5 seconds to catch status updates (especially for processing -> complete/error)
        const interval = setInterval(() => {
            checkEligibilityStatus();
        }, 5000);

        return () => clearInterval(interval);
    }, [appointments]);
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {index + 1}
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
                            <td className="px-4 py-3 text-sm text-gray-900">
                                <div className="max-w-xs flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">
                                            {appointment.payer_name || appointment.receiver_name || appointment.payer_type || "N/A"}
                                        </p>
                                        {appointment.network_name && (
                                            <p className="text-xs text-gray-500 truncate">
                                                {appointment.network_name}
                                            </p>
                                        )}
                                        {appointment.payer_type && appointment.payer_name && (
                                            <p className="text-xs text-gray-500 truncate">
                                                Type: {appointment.payer_type}
                                            </p>
                                        )}
                                    </div>
                                    {/* Eligibility status indicator */}
                                    {eligibilityStatus[appointment.mpi] && (
                                        <div className="flex-shrink-0 mt-1">
                                            {eligibilityStatus[appointment.mpi] === 'success' ? (
                                                <span
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600"
                                                    title="Eligibility check successful"
                                                >
                                                    <svg
                                                        className="w-3 h-3"
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
                                                </span>
                                            ) : eligibilityStatus[appointment.mpi] === 'processing' ? (
                                                <span
                                                    className="inline-block w-3 h-3 rounded-full bg-yellow-500 animate-pulse"
                                                    title="Eligibility check in progress"
                                                />
                                            ) : (
                                                <span
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600"
                                                    title="Eligibility check failed or error"
                                                >
                                                    <svg
                                                        className="w-3 h-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={3}
                                                            d="M6 18L18 6M6 6l12 12"
                                                        />
                                                    </svg>
                                                </span>
                                            )}
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
                                        <p className="text-xs text-gray-500 truncate">
                                            {appointment.specialisation_name}
                                        </p>
                                    )}
                                    {appointment.physician_id && (
                                        <p className="text-xs text-gray-400 truncate">
                                            ID: {appointment.physician_id}
                                        </p>
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
                                {appointment.visit_type || "N/A"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                {eligibilityStatus[appointment.mpi] ? (
                                    eligibilityStatus[appointment.mpi] === 'success' ? (
                                        <span
                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600"
                                            title="Eligibility check successful"
                                        >
                                            <svg
                                                className="w-4 h-4"
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
                                        </span>
                                    ) : eligibilityStatus[appointment.mpi] === 'processing' ? (
                                        <span
                                            className="inline-block w-3 h-3 rounded-full bg-yellow-500 animate-pulse"
                                            title="Eligibility check in progress"
                                        />
                                    ) : (
                                        <span
                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600"
                                            title="Eligibility check failed or error"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={3}
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </span>
                                    )
                                ) : (
                                    <span className="text-gray-300">—</span>
                                )}
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

