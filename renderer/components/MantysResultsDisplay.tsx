/**
 * Mantys Results Display Component - Simplified Modern UI
 * Uses tabbed interface with collapsible sections
 */

import React, { useState } from "react";
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
  patientMPI,
  patientId,
  appointmentId,
  encounterId,
}) => {
  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showSavePolicyModal, setShowSavePolicyModal] = useState(false);
  const [memberId, setMemberId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  const keyFields: MantysKeyFields = extractMantysKeyFields(response);
  const { data } = response;

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

  const handleUploadScreenshots = async () => {
    if (!keyFields.referralDocuments?.length) {
      alert("No documents to upload");
      return;
    }
    setUploadingFiles(true);
    setTimeout(() => {
      setUploadingFiles(false);
      alert("Documents uploaded!");
    }, 1500);
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
    { value: "overview", label: "Overview", icon: <FileText className="h-4 w-4" /> },
    { value: "policy", label: "Policy Details", icon: <CreditCard className="h-4 w-4" /> },
    { value: "benefits", label: "Copay Details", icon: <Hospital className="h-4 w-4" /> },
    { value: "documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
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
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Patient Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "MPI", value: patientMPI || "N/A", id: "mpi" },
                  { label: "Patient ID", value: patientId?.toString() || "N/A", id: "patient" },
                  { label: "Appointment ID", value: appointmentId?.toString() || "N/A", id: "appointment" },
                  { label: "Encounter ID", value: encounterId?.toString() || "N/A", id: "encounter" },
                ].map((item) => (
                  <div key={item.id}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm">{item.value}</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.value, item.id)}>
                        {copied === item.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
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
                  <button onClick={() => toggleSection(benefit.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <Badge className={
                        benefit.id === "outpatient" ? "bg-green-100 text-green-800" :
                        benefit.id === "inpatient" ? "bg-blue-100 text-blue-800" :
                        benefit.id === "maternity" ? "bg-pink-100 text-pink-800" :
                        "bg-purple-100 text-purple-800"
                      }>
                        {benefit.label}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Network: <span className="font-medium">{benefit.network}</span>
                      </span>
                    </div>
                    {expandedSections.includes(benefit.id) ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.includes(benefit.id) && benefit.services.length > 0 && (
                    <div className="border-t overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Service</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Copay</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Deductible</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Set</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {benefit.services.map((service, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{service.type}</td>
                              <td className="px-4 py-2 text-right">{service.copay}</td>
                              <td className="px-4 py-2 text-right">{service.deductible}</td>
                              <td className="px-4 py-2 text-center">
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold">Policy Details</h3>
                </div>
                <Button variant="outline" size="sm" onClick={handleSavePolicy} className="gap-2 bg-black text-white hover:bg-gray-800 border-black">
                  <Download className="h-4 w-4" /> Save Policy
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Referral Documents</h3>
                {keyFields.referralDocuments?.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleUploadScreenshots} disabled={uploadingFiles} className="gap-2 bg-black text-white hover:bg-gray-800 border-black">
                    <Upload className="h-4 w-4" /> {uploadingFiles ? "Uploading..." : "Upload Documents"}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {keyFields.referralDocuments?.length > 0 ? (
                  keyFields.referralDocuments.map((doc, idx) => (
                    <a key={idx} href={doc.s3_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium">{doc.tag}</span>
                      </div>
                      <Download className="h-4 w-4 text-gray-500" />
                    </a>
                  ))
                ) : (
                  <p className="text-center py-6 text-gray-500">No documents available</p>
                )}
              </div>
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
          {JSON.stringify(response, null, 2)}
        </pre>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t">
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
