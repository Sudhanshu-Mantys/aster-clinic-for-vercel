# Insurance Policy Information Form - Isolated Code

## Overview
This document isolates the "Insurance Policy Information" / "Insurance Detail - Save Policy" form from the MantysResultsDisplay component.

---

## Component Location
**File**: `renderer/components/MantysResultsDisplay.tsx`
**Modal Title**: "Insurance Detail - Save Policy"
**Section Title**: "Insurance Policy Information"

---

## Form State Variables

```typescript
// Form field states
const [memberId, setMemberId] = useState<string>("");
const [receiverId, setReceiverId] = useState<string>("");
const [selectedPayer, setSelectedPayer] = useState<any | null>(null);
const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
const [startDate, setStartDate] = useState<string>("");
const [lastRenewalDate, setLastRenewalDate] = useState<string>("");
const [expiryDate, setExpiryDate] = useState<string>("");
const [rateCard, setRateCard] = useState<string>("");

// Patient Payable states
const [hasDeductible, setHasDeductible] = useState<boolean>(false);
const [deductibleFlat, setDeductibleFlat] = useState<string>("");
const [deductibleMax, setDeductibleMax] = useState<string>("");
const [hasCopay, setHasCopay] = useState<boolean>(false);
const [chargeGroups, setChargeGroups] = useState<Array<{
  name: string;
  flat: string;
  percent: string;
  max: string;
}>>([]);

// Config data from API
const [tpaConfig, setTpaConfig] = useState<any>(null);
const [plansConfig, setPlansConfig] = useState<any[]>([]);
const [networksConfig, setNetworksConfig] = useState<any[]>([]);
const [planMappings, setPlanMappings] = useState<any[]>([]);
const [payersConfig, setPayersConfig] = useState<any[]>([]);

// Modal control
const [showSavePolicyModal, setShowSavePolicyModal] = useState(false);
const [savingPolicy, setSavingPolicy] = useState(false);
const [policySaved, setPolicySaved] = useState(false);
```

---

## Props Passed to Component

```typescript
interface MantysResultsDisplayProps {
  response: MantysEligibilityResponse;  // Mantys API response with eligibility data
  onClose?: () => void;
  onCheckAnother?: () => void;
  screenshot?: string | null;
  patientMPI?: string;          // Patient MPI identifier
  patientId?: number;           // Patient ID (enriched from Redis if not provided)
  appointmentId?: number;       // Appointment ID (enriched from Redis if not provided)
  encounterId?: number;         // Encounter ID (enriched from Redis if not provided)
}
```

---

## Data Sources & Auto-population Logic

### 1. **TPA Configuration Loading**
```typescript
// Loads when component mounts or TPA changes
useEffect(() => {
  const loadTPAConfig = async () => {
    if (!selectedClinicId || !response.tpa) return;

    // Fetch TPA config
    const configResponse = await fetch(`/api/clinic-config/tpa?clinic_id=${selectedClinicId}`);
    const configData = await configResponse.json();
    
    // Find config by ins_code, tpa_id, or payer_code
    let config = configData.configs.find((c: any) => c.ins_code === response.tpa);
    if (!config) config = configData.configs.find((c: any) => c.tpa_id === response.tpa);
    if (!config) config = configData.configs.find((c: any) => c.payer_code === response.tpa);
    
    if (config) {
      setTpaConfig(config);
      
      // Load related configs
      const tpaInsCode = config.ins_code || response.tpa;
      
      // Load plans
      const plansResponse = await fetch(`/api/clinic-config/plans?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
      setPlansConfig(plansData.plans);
      
      // Load networks
      const networksResponse = await fetch(`/api/clinic-config/mantys-networks?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
      setNetworksConfig(networksData.networks);
      
      // Load plan mappings
      const mappingsResponse = await fetch(`/api/clinic-config/plan-mappings?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
      setPlanMappings(mappingsData.mappings);
      
      // Load payers
      const payersResponse = await fetch(`/api/clinic-config/payers?clinic_id=${selectedClinicId}&tpa_ins_code=${tpaInsCode}`);
      setPayersConfig(payersData.payers);
    }
  };

  loadTPAConfig();
}, [selectedClinicId, response.tpa]);
```

### 2. **Auto-select Plan from Network Mapping**
```typescript
// When network is selected, auto-select matching plan
useEffect(() => {
  if (!selectedNetwork || planMappings.length === 0 || plansConfig.length === 0) return;

  // Find mappings for the selected network
  const networkMappings = planMappings.filter(
    (m: any) => m.mantys_network_name === selectedNetwork
  );

  if (networkMappings.length > 0) {
    const defaultMapping = networkMappings.find((m: any) => m.is_default);
    const mappingToUse = defaultMapping || networkMappings[0];

    // Find the plan from config
    const mappedPlan = plansConfig.find(
      (p: any) => p.plan_id === mappingToUse.lt_plan_id
    );

    if (mappedPlan) {
      setSelectedPlan(mappedPlan);
    }
  }
}, [selectedNetwork, planMappings, plansConfig]);
```

### 3. **Form Auto-population on "Save Policy" Click**
```typescript
const handleSavePolicy = async () => {
  // Initialize form fields from Mantys response
  setMemberId(data.patient_info?.patient_id_info?.member_id || 
              data.patient_info?.policy_primary_member_id || "");
  
  setReceiverId(tpaConfig?.tpa_name || response.tpa || "");

  // Auto-select network
  if (data.policy_network?.all_networks && data.policy_network.all_networks.length > 0) {
    const firstNetwork = data.policy_network.all_networks[0];
    setSelectedNetwork(firstNetwork.network_value || firstNetwork.network || null);
  }

  // Auto-match plan by name
  const planNameFromMantys = data.patient_info?.plan_name;
  if (planNameFromMantys && plansConfig.length > 0) {
    const matchingPlan = plansConfig.find((plan: any) => {
      const planName = plan.insurance_plan_name?.toLowerCase() || "";
      const mantysPlanName = planNameFromMantys.toLowerCase();
      return planName === mantysPlanName || planName.includes(mantysPlanName);
    });
    if (matchingPlan) {
      setSelectedPlan(matchingPlan);
      setRateCard(matchingPlan.plan_code || "");
    }
  }

  // Parse and set dates
  const parseDateToISO = (dateValue: any): string | null => {
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    if (typeof dateValue === 'object' && dateValue.DD && dateValue.MM && dateValue.YYYY) {
      return `${dateValue.YYYY}-${String(dateValue.MM).padStart(2, '0')}-${String(dateValue.DD).padStart(2, '0')}`;
    }
    return null;
  };

  // Set start date
  const startDateValue = data.policy_start_date || 
                        data.policy_network?.start_date;
  setStartDate(parseDateToISO(startDateValue) || "");

  // Set expiry date
  const expiryDateValue = data.policy_end_date || 
                          data.policy_network?.valid_upto;
  setExpiryDate(parseDateToISO(expiryDateValue) || "");

  // Auto-populate copay details from Mantys response
  const copayDetails = data.copay_details_to_fill?.[0];
  if (copayDetails?.values_to_fill) {
    const chargeGroupsData: Array<{ name: string; flat: string; percent: string; max: string }> = [];
    const values = copayDetails.values_to_fill;

    if (values.LAB) {
      chargeGroupsData.push({
        name: "Laboratory",
        flat: values.LAB.copay || "0",
        percent: "0",
        max: values.LAB._maxDeductible || values.LAB.deductible || "0",
      });
    }
    if (values.MEDICINES) {
      chargeGroupsData.push({
        name: "Medicine",
        flat: values.MEDICINES.copay || "0",
        percent: "0",
        max: values.MEDICINES._maxDeductible || values.MEDICINES.deductible || "0",
      });
    }
    // ... similar for RADIOLOGY, CONSULTATION, PROCEDURE, DENTAL

    setChargeGroups(chargeGroupsData);
    setHasDeductible(chargeGroupsData.some(cg => parseFloat(cg.max) > 0));
    setHasCopay(chargeGroupsData.some(cg => parseFloat(cg.flat) > 0));
  }

  // Auto-match payer
  const ensurePayersConfigLoaded = async () => { /* ... */ };
  const currentPayersConfig = await ensurePayersConfigLoaded();
  
  // Extract payer code from response
  let payerCodeToMatch: string | null = null;
  if (data.payer_id && /^(INS|TPA|D|DHPO|RIYATI|SP|A)[0-9A-Z]+$/.test(String(data.payer_id).toUpperCase())) {
    payerCodeToMatch = String(data.payer_id).toUpperCase();
  } else if (data.policy_network?.payer_name) {
    const codeMatch = data.policy_network.payer_name.match(/\b(INS|TPA|D|DHPO|RIYATI|SP|A)[0-9A-Z]+\b/i);
    if (codeMatch) payerCodeToMatch = codeMatch[0].toUpperCase();
  }

  // Match payer by code
  if (payerCodeToMatch) {
    const matchingPayer = currentPayersConfig.find((p: any) => 
      String(p.ins_tpa_code || '').trim().toUpperCase() === payerCodeToMatch!.trim().toUpperCase()
    );
    if (matchingPayer) {
      setSelectedPayer(matchingPayer);
    }
  }

  setShowSavePolicyModal(true);
};
```

---

## Form JSX Structure

```tsx
<Modal
  isOpen={showSavePolicyModal}
  onClose={() => setShowSavePolicyModal(false)}
  title="Insurance Detail - Save Policy"
>
  <div className="flex flex-col min-h-full">
    {/* Scrollable Content */}
    <div className="flex-1 p-6 space-y-6">
      
      {/* ========== SECTION 1: Insurance Policy Information ========== */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Insurance Policy Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          
          {/* Insurance Card # (Member ID) - REQUIRED */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Insurance Card # (Member ID) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              placeholder="Enter member ID"
            />
          </div>

          {/* Receiver ID - REQUIRED */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Receiver ID <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              placeholder="Enter receiver ID"
            />
          </div>

          {/* Payer - REQUIRED (Searchable Dropdown) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Payer <span className="text-red-600">*</span>
            </label>
            <Select
              value={
                selectedPayer
                  ? {
                      value: selectedPayer.reciever_payer_id,
                      label: selectedPayer.ins_tpa_name,
                    }
                  : null
              }
              onChange={(selected) => {
                const payer = payersConfig.find((p: any) => p.reciever_payer_id === selected?.value);
                setSelectedPayer(payer || null);
              }}
              options={payersConfig.map((payer: any) => ({
                value: payer.reciever_payer_id,
                label: payer.ins_tpa_name,
              }))}
              placeholder="Select payer"
              isSearchable
            />
          </div>

          {/* Plan - REQUIRED (Searchable Dropdown, filtered by network mapping) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Plan <span className="text-red-600">*</span>
            </label>
            <Select
              value={
                selectedPlan
                  ? {
                      value: selectedPlan.plan_id,
                      label: `${selectedPlan.plan_id} - ${selectedPlan.insurance_plan_name}`,
                    }
                  : null
              }
              onChange={(selected) => {
                const plan = plansConfig.find((p: any) => p.plan_id === selected?.value);
                setSelectedPlan(plan || null);
                if (plan) setRateCard(plan.plan_code || "");
              }}
              options={(() => {
                // Filter plans by network mapping if network is selected
                if (selectedNetwork && planMappings.length > 0) {
                  const mappedPlanIds = planMappings
                    .filter((m: any) => m.mantys_network_name === selectedNetwork)
                    .map((m: any) => m.lt_plan_id);
                  if (mappedPlanIds.length > 0) {
                    return plansConfig
                      .filter((plan: any) => mappedPlanIds.includes(plan.plan_id))
                      .map((plan: any) => ({
                        value: plan.plan_id,
                        label: `${plan.plan_id} - ${plan.insurance_plan_name}`,
                      }));
                  }
                }
                return plansConfig.map((plan: any) => ({
                  value: plan.plan_id,
                  label: `${plan.plan_id} - ${plan.insurance_plan_name}`,
                }));
              })()}
              placeholder="Select plan"
              isSearchable
            />
          </div>

          {/* Rate Card (auto-filled from selected plan) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Rate Card
            </label>
            <input
              type="text"
              value={rateCard}
              onChange={(e) => setRateCard(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              placeholder="Enter rate card"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Start Date (DD/MM/YYYY)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          {/* Last Renewal Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Last Renewal Date (DD/MM/YYYY)
            </label>
            <input
              type="date"
              value={lastRenewalDate}
              onChange={(e) => setLastRenewalDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          {/* Expiry Date - REQUIRED */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Expiry Date (DD/MM/YYYY) <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ========== SECTION 2: Patient Payable ========== */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Payable</h3>

        {/* Deductible Radio + Fields */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Deductible</label>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={hasDeductible}
                onChange={() => setHasDeductible(true)}
                className="w-4 h-4"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!hasDeductible}
                onChange={() => setHasDeductible(false)}
                className="w-4 h-4"
              />
              <span>No</span>
            </label>
          </div>
          {hasDeductible && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Flat *</label>
                <input
                  type="number"
                  value={deductibleFlat}
                  onChange={(e) => setDeductibleFlat(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max</label>
                <input
                  type="number"
                  value={deductibleMax}
                  onChange={(e) => setDeductibleMax(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        {/* CoPay Radio */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">CoPay</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={hasCopay}
                onChange={() => setHasCopay(true)}
                className="w-4 h-4"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!hasCopay}
                onChange={() => setHasCopay(false)}
                className="w-4 h-4"
              />
              <span>No</span>
            </label>
          </div>
        </div>

        {/* Charge Group Table (shown if CoPay = Yes) */}
        {hasCopay && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Charge Group</label>
            <div className="border border-gray-300 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Charge Group</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Flat</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">%</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {chargeGroups.map((cg, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 px-3">{cg.name}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={cg.flat}
                          onChange={(e) => {
                            const updated = [...chargeGroups];
                            updated[idx].flat = e.target.value;
                            setChargeGroups(updated);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={cg.percent}
                          onChange={(e) => {
                            const updated = [...chargeGroups];
                            updated[idx].percent = e.target.value;
                            setChargeGroups(updated);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={cg.max}
                          onChange={(e) => {
                            const updated = [...chargeGroups];
                            updated[idx].max = e.target.value;
                            setChargeGroups(updated);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                  {chargeGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-gray-500 text-sm">
                        No charge groups configured. Copay details will be populated from Mantys response.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========== SECTION 3: Primary Insurance Holder Details Summary ========== */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Primary Insurance Holder Details</h3>
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Card #</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Receiver</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Payer</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Plan</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Expiry Date</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Status</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Relation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-3">{memberId || "-"}</td>
                <td className="py-2 px-3">{receiverId || "-"}</td>
                <td className="py-2 px-3">{selectedPayer?.ins_tpa_name || "-"}</td>
                <td className="py-2 px-3">
                  {selectedPlan ? `${selectedPlan.plan_id} - ${selectedPlan.insurance_plan_name}` : "-"}
                </td>
                <td className="py-2 px-3">
                  {expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : "-"}
                </td>
                <td className="py-2 px-3">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>
                </td>
                <td className="py-2 px-3">Self</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ========== Action Buttons - Sticky Footer ========== */}
    <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 px-6 py-4 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] mt-6 -mx-6 -mb-6 z-10">
      <Button
        variant="outline"
        onClick={() => setShowSavePolicyModal(false)}
        disabled={savingPolicy}
        className="px-6 py-2.5"
      >
        Cancel
      </Button>
      <Button
        onClick={handleConfirmSavePolicy}
        disabled={savingPolicy || !selectedPlan}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 text-base shadow-md hover:shadow-lg transition-all"
      >
        {savingPolicy ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" /* ... */>
              {/* ... spinner SVG ... */}
            </svg>
            Saving...
          </>
        ) : (
          "Update Insurance Details"
        )}
      </Button>
    </div>
  </div>
</Modal>
```

---

## Save Policy API Call

```typescript
const handleConfirmSavePolicy = async () => {
  const finalPatientId = enrichedPatientId || patientId;
  const finalAppointmentId = enrichedAppointmentId || appointmentId;
  const finalEncounterId = enrichedEncounterId || encounterId;

  if (!finalPatientId || !finalAppointmentId) {
    alert("Missing required patient information (Patient ID or Appointment ID).");
    return;
  }

  setSavingPolicy(true);
  setShowSavePolicyModal(false);

  try {
    // Get config values with fallbacks
    const siteId = tpaConfig?.lt_site_id ? parseInt(tpaConfig.lt_site_id, 10) : 31;
    const customerId = tpaConfig?.lt_customer_id ? parseInt(tpaConfig.lt_customer_id, 10) : 1;
    const createdBy = user?.id ? parseInt(user.id, 10) : 13295;
    const ltOtherConfig = tpaConfig?.lt_other_config || {};

    // Get insurance mapping ID from config or Mantys response
    const insuranceMappingId = tpaConfig?.hospital_insurance_mapping_id
      ? tpaConfig.hospital_insurance_mapping_id
      : (data.patient_info?.insurance_mapping_id ? parseInt(data.patient_info.insurance_mapping_id, 10) : null);

    // Get plan code and plan ID from selected plan
    let planCodeFromConfig: string | null = null;
    let planIdFromConfig: number | null = null;
    if (selectedPlan) {
      planCodeFromConfig = selectedPlan.plan_code || null;
      planIdFromConfig = selectedPlan.plan_id || null;
    }

    // Get network ID
    let networkIdToUse: string | null = null;
    if (selectedNetwork) {
      const networkFromMantys = data.policy_network?.all_networks?.find(
        (n: any) => n.network_value === selectedNetwork || n.network === selectedNetwork
      );
      networkIdToUse = networkFromMantys?.network || data.policy_network?.network_id || selectedNetwork;
    }

    // Build policy data object
    const policyData = {
      policyId: data.patient_info?.policy_id || null,
      isActive: 1,
      payerId: data.patient_info?.payer_id || null,
      insuranceCompanyId: null,
      networkId: networkIdToUse,
      siteId: siteId,
      policyNumber: data.patient_info?.patient_id_info?.policy_number || null,
      insuranceGroupPolicyId: null,
      encounterid: finalEncounterId || null,
      parentInsPolicyId: null,
      tpaCompanyId: data.patient_info?.tpa_id || null,
      planName: selectedPlan?.insurance_plan_name || data.patient_info?.plan_name || null,
      planCode: planCodeFromConfig,
      planId: planIdFromConfig,
      eligibilityReqId: null,
      tpaPolicyId: data.patient_info?.patient_id_info?.member_id || null,
      insRules: null,
      orgId: null,
      insuranceMappingId: insuranceMappingId,
      tpaGroupPolicyId: null,
      apntId: finalAppointmentId,
      insuranceValidTill: data.policy_end_date || null,
      orgName: null,
      tpaValidTill: data.policy_end_date || null,
      patientId: finalPatientId,
      insuranceRenewal: null,
      payerType: ltOtherConfig.payerType || 1,
      insuranceStartDate: data.policy_start_date || null,
      insurancePolicyId: null,
      hasTopUpCard: 0,
      proposerRelation: "Self",
      createdBy: createdBy,
      empId: null,
      requestLetter: null,
      insertType: ltOtherConfig.insertType || 2,
      customerId: customerId,
      type: ltOtherConfig.type || 1,
      relationshipId: ltOtherConfig.relationshipId || 26,
      priorityPatientApplicable: 0,
      typeId: ltOtherConfig.typeId || 2,
      DepData: null,
    };

    const response = await fetch("/api/aster/save-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyData,
        patientId: finalPatientId,
        appointmentId: finalAppointmentId,
        encounterId: finalEncounterId,
        payerId: data.patient_info?.payer_id,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      setPolicySaved(true);
      alert("Policy details saved successfully!");
    } else {
      alert(`Failed to save policy details: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error saving policy:", error);
    alert("An error occurred while saving policy details.");
  } finally {
    setSavingPolicy(false);
  }
};
```

---

## API Endpoint

**File**: `renderer/pages/api/aster/save-policy.ts`

**Endpoint**: `POST /api/aster/save-policy`

**Request Body**:
```typescript
{
  policyData: {
    // ... full policy object shown above ...
  },
  patientId: number,
  appointmentId: number,
  encounterId: number,
  payerId: string | number
}
```

**External API Call**:
```typescript
POST https://prod.asterclinics.com/SCMS/web/app.php/claim/update/patient/insurace/details/replicate
```

**Payload Structure**:
```json
{
  "head": {
    "reqtime": "Sat Dec 28 2025",
    "srvseqno": "",
    "reqtype": "POST"
  },
  "body": {
    "policyId": 0,
    "isActive": 1,
    "payerId": 123,
    "networkId": 5,
    "siteId": 31,
    "policyNumber": "POL12345",
    "encounterid": null,
    "planName": "Gold Plan",
    "tpaPolicyId": "MEM123456",
    "insuranceMappingId": 456,
    "apntId": 789,
    "insuranceValidTill": "2025-12-31",
    "patientId": 101,
    "payerType": 1,
    "insuranceStartDate": "2025-01-01",
    "proposerRelation": "Self",
    "createdBy": 13295,
    "insertType": 2,
    "customerId": 1,
    "type": 1,
    "relationshipId": 26,
    "typeId": 2
    // ... other fields ...
  }
}
```

---

## Required Fields Summary

**Form Required Fields** (marked with red asterisk):
1. **Insurance Card # (Member ID)** - `memberId`
2. **Receiver ID** - `receiverId`
3. **Payer** - `selectedPayer`
4. **Plan** - `selectedPlan`
5. **Expiry Date** - `expiryDate`

**Submit Button Disabled If**:
- `savingPolicy === true` (saving in progress)
- `!selectedPlan` (no plan selected)

---

## Configuration APIs Used

1. **TPA Config**: `/api/clinic-config/tpa?clinic_id={clinicId}`
2. **Plans**: `/api/clinic-config/plans?clinic_id={clinicId}&tpa_ins_code={tpaInsCode}`
3. **Networks**: `/api/clinic-config/mantys-networks?clinic_id={clinicId}&tpa_ins_code={tpaInsCode}`
4. **Plan Mappings**: `/api/clinic-config/plan-mappings?clinic_id={clinicId}&tpa_ins_code={tpaInsCode}`
5. **Payers**: `/api/clinic-config/payers?clinic_id={clinicId}&tpa_ins_code={tpaInsCode}`

---

## Key Features

1. **Auto-population from Mantys Response**: Member ID, dates, copay details, payer matching
2. **Smart Plan Selection**: Auto-selects plan based on network mapping
3. **Dynamic Charge Groups**: Populated from Mantys copay analysis
4. **Config-driven**: Uses clinic-specific TPA, plan, and payer configurations
5. **Patient Context Enrichment**: Fetches missing patient/appointment IDs from Redis
6. **Validation**: Ensures required fields are filled before submission

---

## Charge Groups Mapping

From Mantys `copay_details_to_fill` to form fields:

| Mantys Field | Charge Group Name | Flat | Max |
|-------------|-------------------|------|-----|
| `LAB` | Laboratory | `copay` | `_maxDeductible` or `deductible` |
| `MEDICINES` | Medicine | `copay` | `_maxDeductible` or `deductible` |
| `RADIOLOGY` | Radiology | `copay` | `_maxDeductible` or `deductible` |
| `CONSULTATION` | Consultation | `copay` | `_maxDeductible` or `deductible` |
| `PROCEDURE` | Procedure | `copay` | `_maxDeductible` or `deductible` |
| `DENTAL CONSULTATION & PROCEDURE` | Dental | `copay` | `_maxDeductible` or `deductible` |

---

## Dependencies

**React Packages**:
- `react`, `react-select`

**UI Components**:
- `Modal` from `./ui/modal`
- `Button` from `./ui/button`
- `Select` from `react-select`

**Contexts**:
- `useAuth` from `../contexts/AuthContext` (for `user.selected_team_id` and `user.id`)

**Types**:
- `MantysEligibilityResponse` from `../types/mantys`

---

## Complete File References

1. **Main Component**: `renderer/components/MantysResultsDisplay.tsx` (lines 1-2317)
2. **Save Policy Modal**: Lines ~1793-2317
3. **Save Policy Handler**: Lines ~462-736
4. **API Endpoint**: `renderer/pages/api/aster/save-policy.ts`
