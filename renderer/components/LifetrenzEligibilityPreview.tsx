import React from "react";
import { MantysEligibilityResponse, MantysKeyFields } from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface LifetrenzEligibilityPreviewProps {
  response: MantysEligibilityResponse;
  onClose: () => void;
}

export const LifetrenzEligibilityPreview: React.FC<
  LifetrenzEligibilityPreviewProps
> = ({ response, onClose }) => {
  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;

  // Format the data that would be sent to Lifetrenz (matching Insurance Detail screen)
  const lifetrenzPayload = {
    // Insurance Card Details
    insuranceCard: {
      cardNumber:
        data.patient_info.patient_id_info.tpa_member_id ||
        data.patient_info.patient_id_info.policy_number ||
        "",
      receiverId: data.patient_info.patient_id_info.client_number || "",
      payerName: data.policy_network.payer_name || keyFields.payerName,
      network:
        keyFields.network || data.policy_network.all_networks[0]?.network || "",
      plan:
        data.policy_network.policy_plan_name ||
        data.policy_network.package_name ||
        "",
      policyNumber: data.patient_info.patient_id_info.policy_number || "",
      corporateName: data.policy_network.sponsor_id || "",
    },
    // Policy Dates
    dates: {
      startDate: data.policy_network.start_date || keyFields.policyStartDate,
      lastRenewalDate: "", // Not available in Mantys response
      expiryDate: data.policy_network.valid_upto || keyFields.policyEndDate,
      rateCard: "", // Not available in Mantys response
    },
    // Patient Payable / Copay Details
    patientPayable: {
      copayDetails: data.copay_details_to_fill || [],
      deductible: data.copay_analysis.waiting_period ? "Yes" : "No",
    },
    // Additional metadata
    metadata: {
      taskId: response.job_task_id,
      tpaName: response.tpa,
      isEligible: keyFields.isEligible,
      checkDate: new Date().toISOString(),
    },
  };

  const handleSendToLifetrenz = () => {
    // This will be implemented when API is ready
    console.log("Insurance data to be sent to Lifetrenz:", lifetrenzPayload);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Send Insurance Data to Lifetrenz
            </h2>
            <p className="text-blue-100 mt-1 text-sm">
              Review the insurance details before sending
            </p>
          </div>
          <Badge className="bg-blue-500 text-white border-blue-400">
            Preview Mode
          </Badge>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="space-y-6">
          {/* Eligibility Status Badge */}
          <div
            className={`rounded-lg p-4 ${
              keyFields.isEligible
                ? "bg-green-50 border-2 border-green-200"
                : "bg-red-50 border-2 border-red-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    keyFields.isEligible ? "bg-green-500" : "bg-red-500"
                  }`}
                >
                  {keyFields.isEligible ? (
                    <svg
                      className="w-6 h-6 text-white"
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
                      className="w-6 h-6 text-white"
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
                  <h3
                    className={`text-lg font-bold ${
                      keyFields.isEligible ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {keyFields.isEligible
                      ? "Patient is Eligible"
                      : "Patient is Not Eligible"}
                  </h3>
                  <p
                    className={`text-sm ${
                      keyFields.isEligible ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    Verified by {response.tpa}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Insurance Card Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                Insurance Card Details
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <DataRow
                label="Insurance Card # (Member ID)"
                value={lifetrenzPayload.insuranceCard.cardNumber}
                highlighted
              />
              <DataRow
                label="Receiver ID"
                value={lifetrenzPayload.insuranceCard.receiverId}
              />
              <DataRow
                label="Payer"
                value={lifetrenzPayload.insuranceCard.payerName}
                highlighted
              />
              <DataRow
                label="Network"
                value={lifetrenzPayload.insuranceCard.network}
              />
              <DataRow
                label="Plan"
                value={lifetrenzPayload.insuranceCard.plan}
              />
              <DataRow
                label="Policy#"
                value={lifetrenzPayload.insuranceCard.policyNumber}
              />
              <DataRow
                label="Corporate Name"
                value={lifetrenzPayload.insuranceCard.corporateName}
              />
            </div>
          </div>

          {/* Policy Dates Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600"
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
                Policy Dates
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <DataRow
                label="Start Date"
                value={lifetrenzPayload.dates.startDate}
              />
              <DataRow
                label="Last Renewal Date"
                value={
                  lifetrenzPayload.dates.lastRenewalDate || "Not Available"
                }
              />
              <DataRow
                label="Expiry Date"
                value={lifetrenzPayload.dates.expiryDate}
                highlighted
              />
              <DataRow
                label="Rate Card"
                value={lifetrenzPayload.dates.rateCard || "Not Available"}
              />
            </div>
          </div>

          {/* Patient Payable Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Patient Payable
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="font-medium text-gray-700">Deductible:</span>
                <Badge
                  className={`${
                    lifetrenzPayload.patientPayable.deductible === "Yes"
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                  }`}
                >
                  {lifetrenzPayload.patientPayable.deductible}
                </Badge>
              </div>

              {/* Copay Details */}
              {lifetrenzPayload.patientPayable.copayDetails.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 text-sm">
                    Copay Details:
                  </h4>
                  <div className="space-y-3">
                    {lifetrenzPayload.patientPayable.copayDetails.map(
                      (copayDetail, idx) => (
                        <div
                          key={idx}
                          className="bg-blue-50 rounded-lg p-3 border border-blue-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 text-sm">
                              {copayDetail.name}
                            </h5>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              {copayDetail.primary_network.network}
                            </Badge>
                          </div>

                          {/* Service-wise breakdown */}
                          <div className="space-y-2 mt-2">
                            {Object.entries(copayDetail.values_to_fill).map(
                              ([service, values]: [string, any]) => (
                                <div
                                  key={service}
                                  className="bg-white rounded p-2 border border-gray-200"
                                >
                                  <div className="font-medium text-xs text-gray-700 mb-2">
                                    {service}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="text-center">
                                      <div className="text-gray-500 mb-1">
                                        Flat
                                      </div>
                                      <div className="font-semibold text-blue-700">
                                        {values.copay}
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-gray-500 mb-1">
                                        %
                                      </div>
                                      <div className="font-semibold text-green-700">
                                        {values.copay}
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-gray-500 mb-1">
                                        Max
                                      </div>
                                      <div className="font-semibold text-orange-700">
                                        {values._maxDeductible ||
                                          values.deductible}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* API Integration Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-semibold text-yellow-900 text-sm">
                  API Integration Pending
                </h4>
                <p className="text-yellow-800 text-xs mt-1">
                  The Lifetrenz API integration is not yet complete. The "Send
                  to Lifetrenz" button is currently disabled. Once the API is
                  ready, this insurance data will be sent automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
        <Button onClick={onClose} variant="outline" className="px-6">
          Cancel
        </Button>
        <Button
          onClick={handleSendToLifetrenz}
          disabled={true}
          className="px-6 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title="API integration pending"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          Send to Lifetrenz
        </Button>
      </div>
    </div>
  );
};

// Helper component for displaying data rows
const DataRow: React.FC<{
  label: string;
  value: string | number;
  highlighted?: boolean;
}> = ({ label, value, highlighted = false }) => {
  if (!value && value !== 0) return null;

  return (
    <div
      className={`flex items-start justify-between py-2 px-3 rounded ${
        highlighted ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
      }`}
    >
      <span className="font-medium text-gray-700 text-sm">{label}:</span>
      <span
        className={`text-gray-900 text-sm text-right ${highlighted ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
};
