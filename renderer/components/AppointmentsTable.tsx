import React, { useMemo, useState } from "react";
import { useEligibilityHistory } from "../hooks/useEligibility";
import { useAuth } from "../contexts/AuthContext";
import type { AppointmentData } from "../lib/api-client";
import { Button } from "./ui/button";
import { Drawer } from "./ui/drawer";
import { Badge } from "./ui/badge";
import { MantysResultsDisplay } from "./MantysResultsDisplay";
import type { MantysEligibilityResponse } from "../types/mantys";
import { asterApi, patientApi } from "../lib/api-client";
import { extractMantysKeyFields } from "../lib/mantys-utils";

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

  const [actionAppointment, setActionAppointment] =
    useState<AppointmentData | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [copiedMpi, setCopiedMpi] = useState<string | null>(null);

  const { data: historyItems = [] } = useEligibilityHistory(clinicId);

  const eligibilityResult = useMemo(() => {
    if (!actionTaskId) return undefined;
    const item = historyItems.find((i) => i.taskId === actionTaskId);
    const rawResult = item?.result;
    if (!rawResult) return undefined;

    // Check if this is a search-all result
    const searchAllResult = rawResult as any;
    if (
      searchAllResult.is_search_all === true &&
      searchAllResult.aggregated_results &&
      Array.isArray(searchAllResult.aggregated_results)
    ) {
      // Find the eligible result from aggregated_results
      const eligibleEntry = searchAllResult.aggregated_results.find(
        (r: any) => r.status === "found" && r.data?.is_eligible === true
      );

      if (eligibleEntry && eligibleEntry.data) {
        // Transform to MantysEligibilityResponse format
        return {
          tpa: eligibleEntry.tpa_name || eligibleEntry.data?.payer_id || "",
          data: eligibleEntry.data,
          status: "found" as const,
          job_task_id: eligibleEntry.data?.job_task_id || searchAllResult.task_id || "",
          task_id: searchAllResult.task_id,
        } as MantysEligibilityResponse;
      }

      // No eligible result found in search-all
      return undefined;
    }

    // Regular (non-search-all) result
    return rawResult as MantysEligibilityResponse;
  }, [actionTaskId, historyItems]);

  const eligibilityStatusMap = useMemo(() => {
    const statusMap: Record<
      string,
      { status: EligibilityStatus; taskId: string }
    > = {};

    const validEligibilityChecks = historyItems.filter((item) =>
      ["complete", "error", "pending", "processing"].includes(item.status),
    );

    const mpiChecks: Record<
      string,
      { item: (typeof historyItems)[0]; timestamp: number }[]
    > = {};

    validEligibilityChecks.forEach((item) => {
      const mpi = item.patientMPI;
      if (mpi) {
        if (!mpiChecks[mpi]) {
          mpiChecks[mpi] = [];
        }
        const timestamp = item.createdAt
          ? new Date(item.createdAt).getTime()
          : 0;
        mpiChecks[mpi].push({ item, timestamp });
      }
    });

    Object.keys(mpiChecks).forEach((mpi) => {
      const checks = mpiChecks[mpi];
      checks.sort((a, b) => b.timestamp - a.timestamp);
      const mostRecent = checks[0].item;

      let status: EligibilityStatus = null;
      const result = mostRecent.result as any;
      const tpaCode = (mostRecent as any).tpaCode || (mostRecent as any).insurancePayer || "";

      // Check if this is a search-all result (from result or tpaCode)
      const isSearchAll = result?.is_search_all === true || tpaCode === "BOTH";

      if (mostRecent.status === "error") {
        status = "error";
      } else if (
        mostRecent.status === "pending" ||
        mostRecent.status === "processing"
      ) {
        status = "processing";
      } else if (mostRecent.status === "complete") {
        if (
          isSearchAll &&
          result?.aggregated_results &&
          Array.isArray(result.aggregated_results)
        ) {
          // Find eligible result in aggregated_results
          const eligibleEntry = result.aggregated_results.find(
            (r: any) => r.status === "found" && r.data?.is_eligible === true
          );
          if (eligibleEntry) {
            status = "success";
          } else {
            // Search-all completed but no eligible results found
            status = "error";
          }
        } else if (isSearchAll && !result) {
          // Search-all but no result data available yet
          status = "error";
        } else {
          // Regular (non-search-all) result
          const resultData = result?.data;
          if (resultData?.is_eligible === true) {
            status = "success";
          } else {
            status = "error";
          }
        }
      }

      statusMap[mpi] = { status, taskId: mostRecent.taskId };
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

  const handleSavePolicy = (appointment: AppointmentData) => {
    const mpi = appointment.mpi;
    if (mpi && eligibilityStatusMap[mpi]?.taskId) {
      setActionAppointment(appointment);
      setActionTaskId(eligibilityStatusMap[mpi].taskId);
      setShowActionDrawer(true);
    }
  };

  const handleUploadScreenshot = async (appointment: AppointmentData) => {
    const mpi = appointment.mpi;
    const taskInfo = eligibilityStatusMap[mpi || ""];

    if (!taskInfo?.taskId) {
      alert("No eligibility check found for this patient");
      return;
    }

    const eligibilityItem = historyItems.find(
      (item) => item.taskId === taskInfo.taskId,
    );
    const response = eligibilityItem?.result as
      | MantysEligibilityResponse
      | undefined;

    if (!response) {
      alert("Eligibility result not found");
      return;
    }

    const keyFields = extractMantysKeyFields(response);

    if (
      !keyFields.referralDocuments ||
      keyFields.referralDocuments.length === 0
    ) {
      alert("No referral documents to upload");
      return;
    }

    const patientId = appointment.patient_id;
    const appointmentId = appointment.appointment_id;

    if (!patientId || !appointmentId) {
      alert("Missing patient or appointment ID");
      return;
    }

    try {
      const insuranceResponse = await patientApi.getInsuranceDetails({
        patientId,
        apntId: appointmentId,
        encounterId: 0,
        customerId: 1,
        primaryInsPolicyId: null,
        siteId: 1,
        isDiscard: 0,
        hasTopUpCard: 0,
      });

      let insTpaPatId: number | null = null;

      if (
        insuranceResponse?.body?.Data &&
        Array.isArray(insuranceResponse.body.Data)
      ) {
        // Priority 1: Active + Valid
        let selectedInsurance = insuranceResponse.body.Data.find(
          (record: any) =>
            record.insurance_status?.toLowerCase() === "active" &&
            record.is_valid === 1,
        );
        // Priority 2: Just Active
        if (!selectedInsurance) {
          selectedInsurance = insuranceResponse.body.Data.find(
            (record: any) =>
              record.insurance_status?.toLowerCase() === "active",
          );
        }
        if (!selectedInsurance) {
          alert("There is no active Insurance policy for this user");
          return;
        }
        const insTpaPatIdValue =
          selectedInsurance?.patient_insurance_tpa_policy_id_sites ||
          selectedInsurance?.patient_insurance_tpa_policy_id;
        if (insTpaPatIdValue) {
          insTpaPatId = Number(insTpaPatIdValue);
        }
        if (!insTpaPatId) {
          alert("There is no active Insurance policy for this user");
          return;
        }
      } else {
        alert("There is no active Insurance policy for this user");
        return;
      }

      let uploadedCount = 0;
      let failedCount = 0;

      for (const doc of keyFields.referralDocuments) {
        try {
          await asterApi.uploadAttachment({
            patientId,
            encounterId: 0,
            appointmentId,
            insTpaPatId,
            fileName: `${doc.tag.replace(/\s+/g, "_")}.pdf`,
            fileUrl: doc.s3_url,
          });
          uploadedCount++;
        } catch (error) {
          console.error(`Failed to upload ${doc.tag}:`, error);
          failedCount++;
        }
      }

      if (failedCount === 0) {
        alert(
          `SUCCESS!\n\nAll ${uploadedCount} documents uploaded successfully!`,
        );
      } else {
        alert(
          `Partially completed\n\nUploaded: ${uploadedCount}\nFailed: ${failedCount}`,
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload documents");
    }
  };

  const handleCloseActionDrawer = () => {
    setShowActionDrawer(false);
    setTimeout(() => {
      setActionAppointment(null);
      setActionTaskId(null);
    }, 300);
  };

  const handleCopyMpi = (mpi: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mpi);
    setCopiedMpi(mpi);
    setTimeout(() => setCopiedMpi(null), 2000);
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
    } else if (
      statusLower.includes("confirmed") ||
      statusLower.includes("approved")
    ) {
      return "bg-green-100 text-green-800";
    } else if (
      statusLower.includes("arrived") ||
      statusLower.includes("checked in")
    ) {
      return "bg-indigo-100 text-indigo-800";
    } else if (
      statusLower.includes("in progress") ||
      statusLower.includes("waiting")
    ) {
      return "bg-yellow-100 text-yellow-800";
    } else if (statusLower.includes("completed")) {
      return "bg-emerald-100 text-emerald-800";
    } else if (
      statusLower.includes("cancelled") ||
      statusLower.includes("no show")
    ) {
      return "bg-red-100 text-red-800";
    } else if (
      statusLower.includes("pending") ||
      statusLower.includes("on hold")
    ) {
      return "bg-orange-100 text-orange-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const renderEligibilityIcon = (
    status: EligibilityStatus,
    size: "sm" | "md" = "md",
  ) => {
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
          <svg
            className={iconSize}
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
        <svg
          className={iconSize}
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
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-12">
                SI.No
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-48">
                Patient Details
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-32">
                Appt Date/Time
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                Payer
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
                Physician
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-36">
                Status
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-40">
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
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 truncate">
                  {index + 1}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900">
                  <div className="truncate">
                    <p className="font-medium truncate">
                      {appointment.full_name || "N/A"}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="truncate">MPI: {appointment.mpi}</span>
                      <button
                        onClick={(e) => handleCopyMpi(appointment.mpi, e)}
                        className="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors"
                        title={copiedMpi === appointment.mpi ? "Copied!" : "Copy MPI"}
                      >
                        {copiedMpi === appointment.mpi ? (
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {appointment.age && (
                      <p className="text-xs text-gray-500 truncate">
                        {appointment.age} | {appointment.gender}
                      </p>
                    )}
                    {appointment.mobile_phone && (
                      <p className="text-xs text-gray-500 truncate">
                        Mo No. {appointment.mobile_phone}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-900">
                  <div className="truncate">
                    <p className="font-medium truncate">
                      {appointment.appointment_date || "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {appointment.appointment_time || ""}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-900">
                  <div className="flex items-start gap-2 truncate">
                    <div className="flex-1 min-w-0 truncate">
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
                          </>
                        );
                      })()}
                    </div>
                    {eligibilityStatusMap[appointment.mpi]?.status && (
                      <div className="flex-shrink-0 mt-1">
                        {renderEligibilityIcon(eligibilityStatusMap[appointment.mpi]?.status, "sm")}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-900">
                  <div className="truncate">
                    <p className="font-medium truncate">
                      {appointment.provider ||
                        appointment.physician_name ||
                        "N/A"}
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
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(
                        appointment.appointment_status,
                      )}`}
                    >
                      {appointment.appointment_status || "Unknown"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 w-fit">
                      {(appointment as any).visit_type || "N/A"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-left">
                  {eligibilityStatusMap[appointment.mpi]?.status ===
                    "success" ? (
                    <div className="flex flex-col gap-1 items-start">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePolicy(appointment);
                        }}
                        className="w-full bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs font-medium"
                      >
                        Save Policy
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadScreenshot(appointment);
                        }}
                        className="w-full bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs font-medium"
                      >
                        Upload Documents
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(appointment);
                      }}
                      className="w-full text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details
                    </button>
                  )}
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
                  <h3 className="font-semibold text-gray-900">
                    {appointment.full_name || "N/A"}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span>MPI: {appointment.mpi}</span>
                    <button
                      onClick={(e) => handleCopyMpi(appointment.mpi, e)}
                      className="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors"
                      title={copiedMpi === appointment.mpi ? "Copied!" : "Copy MPI"}
                    >
                      {copiedMpi === appointment.mpi ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {appointment.mobile_phone && (
                    <p className="text-sm text-gray-500">
                      Mo No. {appointment.mobile_phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Date/Time</p>
                  <p className="font-medium">
                    {appointment.appointment_date || "N/A"}
                  </p>
                  <p className="text-gray-600">
                    {appointment.appointment_time || ""}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Status</p>
                  <div className="flex flex-col gap-1 mt-0.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(
                        appointment.appointment_status,
                      )}`}
                    >
                      {appointment.appointment_status || "Unknown"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 w-fit">
                      {(appointment as any).visit_type || "N/A"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Payer</p>
                  <div className="flex items-start gap-2">
                    <p className="font-medium truncate">
                      {tpaName ||
                        appointment.network_name ||
                        appointment.payer_name ||
                        appointment.payer_type ||
                        "N/A"}
                    </p>
                    {eligibilityStatusMap[appointment.mpi]?.status && (
                      <div className="flex-shrink-0 mt-0.5">
                        {renderEligibilityIcon(eligibilityStatusMap[appointment.mpi]?.status, "sm")}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-gray-500 text-xs">Physician</p>
                  <p className="font-medium truncate">
                    {appointment.provider ||
                      appointment.physician_name ||
                      "N/A"}
                  </p>
                </div>
              </div>

              {appointment.specialisation_name && (
                <p className="mt-2 text-xs text-gray-500">
                  {appointment.specialisation_name}
                </p>
              )}

              {eligibilityStatusMap[appointment.mpi]?.status === "success" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSavePolicy(appointment);
                    }}
                    className="flex-1 bg-black hover:bg-gray-800 text-white py-2 rounded text-sm font-medium"
                  >
                    Save Policy
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadScreenshot(appointment);
                    }}
                    className="flex-1 bg-black hover:bg-gray-800 text-white py-2 rounded text-sm font-medium"
                  >
                    Upload Documents
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAppointmentClick(appointment);
                  }}
                  className="mt-4 w-full text-center text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  View Details
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{appointments.length}</span>{" "}
            appointment(s)
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">
            Click on any row to view full details
          </div>
        </div>
      </div>

      {showActionDrawer && actionAppointment && eligibilityResult && (
        <Drawer
          isOpen={showActionDrawer}
          onClose={handleCloseActionDrawer}
          title={`Eligibility Actions - ${actionAppointment.full_name}`}
          headerRight={(() => {
            const keyFields = extractMantysKeyFields(eligibilityResult);
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
          })()}
          size="xl"
        >
          <MantysResultsDisplay
            response={eligibilityResult}
            onClose={handleCloseActionDrawer}
            onCheckAnother={handleCloseActionDrawer}
            patientMPI={actionAppointment.mpi}
            patientId={actionAppointment.patient_id}
            appointmentId={actionAppointment.appointment_id}
            encounterId={(actionAppointment as any).encounter_id}
            physicianId={(actionAppointment as any).physician_id || (actionAppointment as any).physicianId
              ? (typeof ((actionAppointment as any).physician_id || (actionAppointment as any).physicianId) === 'number'
                ? ((actionAppointment as any).physician_id || (actionAppointment as any).physicianId)
                : parseInt(String((actionAppointment as any).physician_id || (actionAppointment as any).physicianId), 10))
              : undefined}
          />
        </Drawer>
      )}
    </div>
  );
};
