/**
 * Mantys Results Display Component
 * Displays the eligibility check results from Mantys API
 */

import React, { useState } from "react";
import {
  MantysEligibilityResponse,
  MantysKeyFields,
  CopayDetailsToFill,
} from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Sidebar } from "./ui/sidebar";
import { LifetrenzEligibilityPreview } from "./LifetrenzEligibilityPreview";

interface MantysResultsDisplayProps {
  response: MantysEligibilityResponse;
  onClose?: () => void;
  onCheckAnother?: () => void;
  screenshot?: string | null;
  patientMPI?: string;
  patientId?: number;
  appointmentId?: number;
  encounterId?: number;
}

export const MantysResultsDisplay: React.FC<MantysResultsDisplayProps> = ({
  response,
  onClose,
  onCheckAnother,
  screenshot,
  patientMPI,
  patientId,
  appointmentId,
  encounterId,
}) => {
  const [expandedCopay, setExpandedCopay] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;

  const toggleCopayExpanded = (name: string) => {
    setExpandedCopay(expandedCopay === name ? null : name);
  };

  const handleSendToLifetrenz = () => {
    setShowLifetrenzPreview(true);
  };

  const handleCloseLifetrenzPreview = () => {
    setShowLifetrenzPreview(false);
  };

  const handleUploadScreenshots = async () => {
    if (
      !keyFields.referralDocuments ||
      keyFields.referralDocuments.length === 0
    ) {
      alert("No referral documents to upload");
      return;
    }

    // Use provided IDs or show error if not available
    if (!patientId || !encounterId || !appointmentId) {
      alert(
        "Missing required patient information (Patient ID, Encounter ID, or Appointment ID). Please ensure these are available before uploading.",
      );
      setUploadingFiles(false);
      return;
    }

    const insTpaPatId = 8402049; // TODO: Get actual insurance TPA patient ID from response

    setUploadingFiles(true);
    const newUploadProgress: { [key: string]: number } = {};
    const newUploadedFiles: string[] = [];

    try {
      // Upload each referral document
      for (let i = 0; i < keyFields.referralDocuments.length; i++) {
        const doc = keyFields.referralDocuments[i];
        const progressKey = `${doc.tag}_${i}`;

        newUploadProgress[progressKey] = 0;
        setUploadProgress({ ...newUploadProgress });

        console.log(`Uploading ${doc.tag}...`);

        const uploadRequest = {
          patientId,
          encounterId,
          appointmentId,
          insTpaPatId,
          fileName: `${doc.tag.replace(/\s+/g, "_")}.pdf`,
          fileUrl: doc.s3_url,
        };

        const response = await fetch("/api/aster/upload-attachment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(uploadRequest),
        });

        const result = await response.json();

        if (response.ok) {
          newUploadProgress[progressKey] = 100;
          newUploadedFiles.push(doc.tag);
          console.log(`✅ Uploaded ${doc.tag} successfully`);
        } else {
          console.error(`❌ Failed to upload ${doc.tag}:`, result.error);
          newUploadProgress[progressKey] = -1; // Mark as failed
        }

        setUploadProgress({ ...newUploadProgress });
      }

      setUploadedFiles(newUploadedFiles);

      if (newUploadedFiles.length === keyFields.referralDocuments.length) {
        alert(
          `All ${newUploadedFiles.length} documents uploaded successfully!`,
        );
      } else {
        alert(
          `Uploaded ${newUploadedFiles.length} out of ${keyFields.referralDocuments.length} documents. Check console for errors.`,
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload documents. See console for details.");
    } finally {
      setUploadingFiles(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Eligibility Status Header */}
      <div
        className={`rounded-lg p-6 ${keyFields.isEligible
          ? "bg-green-50 border border-green-200"
          : "bg-red-50 border border-red-200"
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${keyFields.isEligible ? "bg-green-500" : "bg-red-500"
                }`}
            >
              {keyFields.isEligible ? (
                <svg
                  className="w-7 h-7 text-white"
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
              ) : (
                <svg
                  className="w-7 h-7 text-white"
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
              )}
            </div>
            <div>
              <h2
                className={`text-2xl font-bold ${keyFields.isEligible ? "text-green-900" : "text-red-900"}`}
              >
                {keyFields.isEligible
                  ? "Patient is Eligible"
                  : "Patient is Not Eligible"}
              </h2>
              <p
                className={`text-sm ${keyFields.isEligible ? "text-green-700" : "text-red-700"}`}
              >
                Status: {response.status}
              </p>
            </div>
          </div>
          <Badge
            className={
              keyFields.isEligible
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-red-100 text-red-800 border-red-300"
            }
          >
            {data.policy_network?.policy_authority || "N/A"}
          </Badge>
        </div>
      </div>

      {/* Screenshot Section */}
      {screenshot && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            TPA Portal Screenshot
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <img
              src={screenshot}
              alt="TPA Portal Screenshot"
              className="w-full h-auto"
              onError={(e) => {
                console.error("Failed to load screenshot");
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            Screenshot captured during eligibility verification process
          </p>
        </Card>
      )}

      {/* Referral Documents */}
      {keyFields.referralDocuments &&
        keyFields.referralDocuments.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Referral Documents
              </h3>
              <Button
                onClick={handleUploadScreenshots}
                disabled={uploadingFiles}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploadingFiles ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Upload Screenshots
                  </>
                )}
              </Button>
            </div>
            <div className="space-y-2">
              {keyFields.referralDocuments.map((doc, idx) => {
                const progressKey = `${doc.tag}_${idx}`;
                const progress = uploadProgress[progressKey];
                const isUploaded = uploadedFiles.includes(doc.tag);

                return (
                  <div key={idx} className="relative">
                    <a
                      href={doc.s3_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 border rounded-lg transition ${isUploaded
                        ? "bg-green-50 border-green-300"
                        : progress === -1
                          ? "bg-red-50 border-red-300"
                          : "bg-blue-50 hover:bg-blue-100 border-blue-200"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 ${isUploaded
                          ? "text-green-600"
                          : progress === -1
                            ? "text-red-600"
                            : "text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {isUploaded ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        ) : progress === -1 ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
                          />
                        )}
                      </svg>
                      <div className="flex-1">
                        <div
                          className={`font-medium ${isUploaded
                            ? "text-green-900"
                            : progress === -1
                              ? "text-red-900"
                              : "text-blue-900"
                            }`}
                        >
                          {doc.tag}
                        </div>
                        {doc.id && (
                          <div
                            className={`text-xs ${isUploaded
                              ? "text-green-700"
                              : progress === -1
                                ? "text-red-700"
                                : "text-blue-700"
                              }`}
                          >
                            ID: {doc.id}
                          </div>
                        )}
                        {isUploaded && (
                          <div className="text-xs text-green-700 font-medium mt-1">
                            ✓ Uploaded to Aster
                          </div>
                        )}
                        {progress === -1 && (
                          <div className="text-xs text-red-700 font-medium mt-1">
                            ✗ Upload failed
                          </div>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 ${isUploaded
                          ? "text-green-600"
                          : progress === -1
                            ? "text-red-600"
                            : "text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                    {progress !== undefined &&
                      progress >= 0 &&
                      progress < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      {/* Patient Information */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Patient Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {patientMPI && (
            <div>
              <span className="font-medium text-gray-700">MPI:</span>
              <p className="text-gray-900 mt-1 font-mono">{patientMPI}</p>
            </div>
          )}
          {patientId && (
            <div>
              <span className="font-medium text-gray-700">Patient ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{patientId}</p>
            </div>
          )}
          {appointmentId && (
            <div>
              <span className="font-medium text-gray-700">Appointment ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{appointmentId}</p>
            </div>
          )}
          {encounterId && (
            <div>
              <span className="font-medium text-gray-700">Encounter ID:</span>
              <p className="text-gray-900 mt-1 font-mono">{encounterId}</p>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Policy Holder:</span>
            <p className="text-gray-900 mt-1">{data.policy_holder_name}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date of Birth:</span>
            <p className="text-gray-900 mt-1">{data.policy_holder_dob}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Gender:</span>
            <p className="text-gray-900 mt-1">
              {data.patient_info?.policy_holder_gender || "N/A"}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Member ID:</span>
            <p className="text-gray-900 mt-1 font-mono">{keyFields.memberId}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Emirates ID:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.policy_holder_emirates_id}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">DHA Member ID:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.patient_info?.policy_primary_dha_member_id || "N/A"}
            </p>
          </div>
        </div>
      </Card>

      {/* Policy Information */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Policy Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Payer Name:</span>
            <p className="text-gray-900 mt-1">{keyFields.payerName}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy Authority:</span>
            <p className="text-gray-900 mt-1">
              {data.policy_network?.policy_authority || "N/A"}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">
              Policy Start Date:
            </span>
            <p className="text-gray-900 mt-1">{keyFields.policyStartDate}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy End Date:</span>
            <p className="text-gray-900 mt-1">{keyFields.policyEndDate}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">
              Network (Card Type):
            </span>
            <p className="text-gray-900 mt-1">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {keyFields.network || "N/A"}
              </Badge>
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Policy Number:</span>
            <p className="text-gray-900 mt-1 font-mono">
              {data.patient_info?.patient_id_info?.policy_number || "N/A"}
            </p>
          </div>
        </div>

        {/* All Networks */}
        {data.policy_network?.all_networks &&
          data.policy_network.all_networks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="font-medium text-gray-700 block mb-2">
                Available Networks:
              </span>
              <div className="flex flex-wrap gap-2">
                {data.policy_network.all_networks.map((network, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2"
                  >
                    <div className="font-semibold text-blue-900">
                      {network.network_value}
                    </div>
                    <div className="text-blue-700">{network.visit_type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </Card>

      {/* Copay Details */}
      {keyFields.copayDetails && keyFields.copayDetails.length > 0 && (
        <Card className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Copay & Deductible Details
          </h3>
          <div className="space-y-3">
            {keyFields.copayDetails.map((copayCategory, idx) => {
              const isExpanded = expandedCopay === copayCategory.name;
              return (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCopayExpanded(copayCategory.name)}
                    className="w-full bg-gray-50 hover:bg-gray-100 p-4 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          copayCategory.name === "Outpatient"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : copayCategory.name === "Inpatient"
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : copayCategory.name === "Maternity"
                                ? "bg-pink-100 text-pink-800 border-pink-200"
                                : "bg-purple-100 text-purple-800 border-purple-200"
                        }
                      >
                        {copayCategory.name}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Primary Network:{" "}
                        <span className="font-medium text-gray-900">
                          {copayCategory.primary_network.network}
                        </span>
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 font-semibold text-gray-700">
                              Service Type
                            </th>
                            <th className="text-right py-2 font-semibold text-gray-700">
                              Copay (%)
                            </th>
                            <th className="text-right py-2 font-semibold text-gray-700">
                              Deductible (AED)
                            </th>
                            <th className="text-center py-2 font-semibold text-gray-700">
                              Set Copay
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(copayCategory.values_to_fill).map(
                            ([serviceType, values]) => (
                              <tr
                                key={serviceType}
                                className="border-b border-gray-100"
                              >
                                <td className="py-2 text-gray-900">
                                  {serviceType}
                                </td>
                                <td className="text-right py-2 text-gray-900 font-medium">
                                  {values.copay}%
                                </td>
                                <td className="text-right py-2 text-gray-900 font-medium">
                                  {values.deductible}
                                </td>
                                <td className="text-center py-2">
                                  {values.should_set_copay ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Special Remarks */}
      {keyFields.specialRemarks && keyFields.specialRemarks.length > 0 && (
        <Card className="p-5 bg-orange-50 border-orange-200">
          <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Important Remarks & Requirements
          </h3>
          <ul className="space-y-2 text-sm text-orange-900">
            {keyFields.specialRemarks.map((remark, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>{remark}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Raw JSON Toggle */}
      <Card className="p-5">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            View Raw JSON Response
          </h3>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showRawJson ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showRawJson && (
          <pre className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg overflow-auto text-xs max-h-96">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white pb-4 border-t border-gray-200 pt-4">
        <div className="flex gap-3">
          {onCheckAnother && (
            <Button
              onClick={onCheckAnother}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Check Another Eligibility
            </Button>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose} className="px-6">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Lifetrenz Data Preview Sidebar */}
      <Sidebar
        isOpen={showLifetrenzPreview}
        onClose={handleCloseLifetrenzPreview}
        title="Send Data to Lifetrenz"
        width="700px"
      >
        <LifetrenzEligibilityPreview
          response={response}
          onClose={handleCloseLifetrenzPreview}
        />
      </Sidebar>
    </div>
  );
};
