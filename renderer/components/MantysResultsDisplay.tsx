/**
 * Mantys Results Display Component - Simplified Modern UI
 * Uses tabbed interface with collapsible sections
 */

import React, { useEffect, useState } from "react";
import {
  MantysEligibilityResponse,
  MantysKeyFields,
} from "../types/mantys";
import { extractMantysKeyFields } from "../lib/mantys-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Sidebar } from "./ui/sidebar";
import { LifetrenzEligibilityPreview } from "./LifetrenzEligibilityPreview";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "./ui/modal";
import {
  asterApi,
} from "../lib/api-client";
import { useMantysActions } from "../hooks/useMantysActions";
import {
  CheckCircle2,
  XCircle,
  FileText,
  User,
  CreditCard,
  Hospital,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
} from "lucide-react";

interface MantysResultsDisplayProps {
  response: MantysEligibilityResponse;
  onClose?: () => void;
  onCheckAnother?: () => void;
  screenshot?: string | null;
  patientMPI?: string;
  patientId?: number;
  appointmentId?: number;
  encounterId?: number;
  physicianId?: number;
}

type TabValue = "overview" | "benefits" | "policy" | "documents";

export const MantysResultsDisplay: React.FC<MantysResultsDisplayProps> = ({
  response,
  onClose,
  onCheckAnother,
  screenshot,
  patientMPI,
  patientId,
  appointmentId,
  encounterId,
  physicianId,
}) => {
  const [activeTab, setActiveTab] = useState<TabValue>("documents");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [v3Result, setV3Result] = useState<unknown | null>(null);
  const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showSavePolicyModal, setShowSavePolicyModal] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(true);
  const [memberId, setMemberId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  const { user } = useAuth();

  const { handleUploadScreenshots, uploadingFiles } = useMantysActions({
    clinicId: user?.selected_team_id,
    response,
    patientMPI,
    patientId,
    appointmentId,
    encounterId,
    physicianId,
  });

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;
  const screenshotSrc = screenshot || data?.screenshot_key || null;

  useEffect(() => {
    setShowScreenshot(true);
  }, [screenshotSrc]);

  useEffect(() => {
    const isFinalStatus = ["found", "not_found", "error"].includes(response.status);
    if (!isFinalStatus) {
      setV3Result(null);
      return;
    }

    const taskId = response.task_id;
    if (!taskId) return;

    let isMounted = true;
    const fetchV3Result = async () => {
      try {
        const resultResponse = await fetch(
          `/api/mantys/eligibility-result-v3?task_id=${encodeURIComponent(taskId)}`,
        );
        if (!resultResponse.ok) {
          throw new Error(`Failed to fetch v3 result: ${resultResponse.status}`);
        }
        const resultData = await resultResponse.json();
        if (isMounted) {
          setV3Result(resultData);
        }
      } catch (error) {
        console.error("Failed to fetch v3 eligibility result:", error);
      }
    };

    fetchV3Result();
    return () => {
      isMounted = false;
    };
  }, [response.status, response.task_id]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleSavePolicy = async () => {
    setMemberId(data.patient_info?.patient_id_info?.member_id || "");
    setReceiverId(response.tpa || "");
    setShowSavePolicyModal(true);
  };

  const handleConfirmSavePolicy = async () => {
    setSavingPolicy(true);
    setShowSavePolicyModal(false);
    try {
      await asterApi.savePolicy({
        policyData: {},
        patientId: patientId || 0,
        appointmentId: appointmentId || 0,
        encounterId: encounterId || 0,
      });
      alert("Policy saved successfully!");
    } catch (error) {
      alert("Failed to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  if (!data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-lg font-semibold text-red-900">Error</h2>
        <p className="text-red-700">Invalid response</p>
        {onClose && <button onClick={onClose} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Close</button>}
      </div>
    );
  }

  const benefitCategories = keyFields.copayDetails?.map((cat) => ({
    id: cat.name.toLowerCase(),
    label: cat.name,
    network: cat.primary_network.network,
    services: Object.entries(cat.values_to_fill).map(([type, values]) => ({
      type,
      copay: `${values.copay}%`,
      deductible: values.deductible,
      setCopay: values.should_set_copay,
    })),
  })) || [];

  const hasBenefits = benefitCategories.some((cat) => cat.services.length > 0);

  const tabs: { value: TabValue; label: string; icon: React.ReactNode }[] = [
    { value: "documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
    { value: "overview", label: "Overview", icon: <User className="h-4 w-4" /> },
    { value: "policy", label: "Policy Details", icon: <CreditCard className="h-4 w-4" /> },
    { value: "benefits", label: "Copay Details", icon: <Hospital className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Action Buttons - 2x2 Grid on Mobile */}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleSavePolicy} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Download className="h-4 w-4" /> Save Policy
        </Button>
        {keyFields.referralDocuments?.length > 0 && (
          <Button onClick={handleUploadScreenshots} disabled={uploadingFiles} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4" /> {uploadingFiles ? "Uploading..." : "Upload Documents"}
          </Button>
        )}
      </div>

      {/* Tab Navigation - 2x2 on Mobile */}
      <div className="border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.value
                  ? "border-blue-600 text-blue-700 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {/* Left Column - 5 items */}
                <div>
                  <p className="text-gray-500">MPI:</p>
                  <p className="font-mono font-medium">{patientMPI || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Patient ID:</p>
                  <p className="font-mono font-medium">{patientId?.toString() || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Appointment ID:</p>
                  <p className="font-mono font-medium">{appointmentId?.toString() || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Encounter ID:</p>
                  <p className="font-mono font-medium">{encounterId?.toString() || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Policy Holder:</p>
                  <p className="font-medium">{data.policy_holder_name || "N/A"}</p>
                </div>
                {/* Right Column - 5 items */}
                <div>
                  <p className="text-gray-500">Date of Birth:</p>
                  <p className="font-medium">{data.policy_holder_dob || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Gender:</p>
                  <p className="font-medium">{data.patient_info?.policy_holder_gender || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Member ID:</p>
                  <p className="font-mono font-medium">{keyFields.memberId || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Emirates ID:</p>
                  <p className="font-mono font-medium">{data.policy_holder_emirates_id || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-500">DHA Member ID:</p>
                  <p className="font-mono font-medium">{data.patient_info?.policy_primary_dha_member_id || "N/A"}</p>
                </div>
              </div>
            </Card>
            {keyFields.specialRemarks?.length > 0 && (
              <Card className="p-4 bg-orange-50 border-orange-200">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-orange-900">Important Remarks</p>
                    <ul className="mt-1 text-sm text-orange-800 space-y-1">
                      {keyFields.specialRemarks.map((remark, idx) => (
                        <li key={idx}>• {remark}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === "benefits" && (
          <div className="space-y-3">
            {hasBenefits ? (
              benefitCategories.map((benefit) => (
                <Card key={benefit.id} className="overflow-hidden">
                  <button onClick={() => toggleSection(benefit.id)} className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={
                        benefit.id === "outpatient" ? "bg-green-100 text-green-800" :
                        benefit.id === "inpatient" ? "bg-blue-100 text-blue-800" :
                        benefit.id === "maternity" ? "bg-pink-100 text-pink-800" :
                        "bg-purple-100 text-purple-800"
                      }>
                        {benefit.label}
                      </Badge>
                      <span className="text-sm text-gray-600 truncate">
                        <span className="hidden sm:inline">Network: </span>
                        <span className="font-medium">{benefit.network}</span>
                      </span>
                    </div>
                    {expandedSections.includes(benefit.id) ? (
                      <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                  </button>
                  {expandedSections.includes(benefit.id) && benefit.services.length > 0 && (
                    <div className="border-t overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Service</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Copay</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Deductible</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Set</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {benefit.services.map((service, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{service.type}</td>
                              <td className="px-3 py-2 text-right">{service.copay}</td>
                              <td className="px-3 py-2 text-right">{service.deductible}</td>
                              <td className="px-3 py-2 text-center">
                                {service.setCopay && <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center text-gray-500">
                No benefits data available
              </Card>
            )}
          </div>
        )}

        {/* Policy Tab */}
        {activeTab === "policy" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Policy Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Payer</p>
                  <p className="font-medium mt-1">{keyFields.payerName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Policy Authority</p>
                  <p className="font-medium mt-1">{data.policy_network?.policy_authority || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium mt-1">{keyFields.policyStartDate || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="font-medium mt-1">{keyFields.policyEndDate || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member ID</p>
                  <p className="font-mono mt-1">{keyFields.memberId || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Policy Number</p>
                  <p className="font-mono mt-1">{data.patient_info?.patient_id_info?.policy_number || "N/A"}</p>
                </div>
              </div>
              {data.policy_network?.all_networks?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">Available Networks</p>
                  <div className="flex flex-wrap gap-2">
                    {data.policy_network.all_networks.map((n: any, i: number) => (
                      <Badge key={i} className="bg-blue-100 text-blue-800">{n.network_value}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold">Referral Documents</h3>
              </div>
              <div className="space-y-2">
                {keyFields.referralDocuments?.length > 0 ? (
                  keyFields.referralDocuments.map((doc, idx) => (
                    <a key={idx} href={doc.s3_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium truncate">{doc.tag}</span>
                      </div>
                      <Download className="h-4 w-4 text-gray-500 shrink-0" />
                    </a>
                  ))
                ) : (
                  <p className="text-center py-6 text-gray-500">No documents available</p>
                )}
              </div>
              {screenshotSrc && showScreenshot && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Eligibility Screenshot
                  </h4>
                  <a
                    href={screenshotSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-sm hover:border-gray-400 transition-colors"
                  >
                    <img
                      src={screenshotSrc}
                      alt="Eligibility verification screenshot"
                      className="w-full h-auto max-h-[420px] object-contain"
                      onError={() => setShowScreenshot(false)}
                    />
                  </a>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Raw JSON Toggle */}
      <button onClick={() => setShowRawJson(!showRawJson)} className="w-full flex items-center justify-between p-2 text-sm text-gray-500 hover:text-gray-700">
        <span>View Raw JSON</span>
        {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {showRawJson && (
        <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs max-h-32 overflow-auto">
          {JSON.stringify(v3Result ? { response, v3Result } : response, null, 2)}
        </pre>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
        {onCheckAnother && (
          <Button onClick={onCheckAnother} className="flex-1 gap-2">
            Check Another Eligibility
          </Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Modals */}
      <Sidebar isOpen={showLifetrenzPreview} onClose={() => setShowLifetrenzPreview(false)} title="Send to Lifetrenz" width="500px">
        <LifetrenzEligibilityPreview response={response} onClose={() => setShowLifetrenzPreview(false)} />
      </Sidebar>

      <Modal isOpen={showSavePolicyModal} onClose={() => setShowSavePolicyModal(false)} title="Save Policy">
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Member ID</label>
              <input type="text" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Receiver ID</label>
              <input type="text" value={receiverId} onChange={(e) => setReceiverId(e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">End Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" onClick={() => setShowSavePolicyModal(false)} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirmSavePolicy} disabled={savingPolicy} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {savingPolicy ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
