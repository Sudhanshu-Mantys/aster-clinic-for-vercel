# Mantys Insurance Eligibility Integration

## Overview

I've integrated the comprehensive Mantys insurance eligibility form into your Aster Clinics application. The form automatically pre-fills with patient and insurance data and supports 50+ insurance providers (TPAs) with their unique requirements and business rules.

## What Was Added

### 1. New Component: `MantysEligibilityForm.tsx`

A comprehensive insurance eligibility verification form that includes:

- **50+ Insurance Providers (TPAs)**: Neuron, NextCare, Al Madallah, NAS, Daman, AXA, ADNIC, and many more
- **Dynamic Form Fields**: Form fields appear/disappear based on selected insurance provider and organization
- **Smart ID Validation**: Auto-formatting for Emirates ID (XXX-XXXX-XXXXXXX-X) and DHA Member ID
- **Pre-filling**: Automatically fills patient name, phone, Emirates ID/Member ID from existing data
- **Organization-Specific Logic**: Different behavior for different organizations (Medcare, Al Noor, HealthHub, etc.)
- **Conditional Fields**:
  - Doctor name (required for specific TPAs)
  - Phone number (required for eCare, Daman, etc.)
  - POD fields (for Daman/Thiqa at eligible locations)
  - Maternity types (for NAS, Neuron)
  - Visit categories (for ADNIC)
  - Service types (for eCare, Lifeline)
  - And many more...

### 2. New UI Component: `Sidebar.tsx`

A reusable right-side sliding sidebar component with:
- Smooth slide-in animation from the right
- Dark backdrop overlay
- Close on Escape key
- Close on backdrop click
- Close button in header
- Scrollable content area
- Prevents body scroll when open
- Customizable width

### 3. Updated Components

#### `InsuranceDetailsSection.tsx`
- Added "Check Eligibility with Mantys" button for active insurance policies
- Integrated the Mantys eligibility form in a right-side sidebar
- Passes patient and insurance data to pre-fill the form
- Manages sidebar open/close state

#### `PatientDetailsDisplay.tsx`
- Updated to pass patient data to InsuranceDetailsSection

#### `MantysEligibilityForm.tsx`
- Redesigned for sidebar display (removed Card wrapper)
- Added patient info summary card at the top
- Sticky submit button at the bottom
- Optimized for vertical scrolling

## How It Works

### User Flow

1. **Search for Patient**: User searches for a patient using MPI, Patient ID, or Phone Number
2. **View Patient Details**: Patient details and insurance records are displayed
3. **Check Eligibility**: Click "✓ Check Eligibility with Mantys" button on any active insurance policy
4. **Sidebar Opens**: A right-side sidebar smoothly slides in from the right
5. **Pre-filled Form**: Mantys eligibility form appears in sidebar with:
   - Patient info summary card at the top
   - Patient name pre-filled
   - Phone number pre-filled
   - Emirates ID/Member ID pre-filled
   - Insurance provider pre-selected (if recognized)
   - Payer name pre-filled
6. **Complete Form**: User completes any additional required fields based on the selected TPA
7. **Submit**: Click "Check Eligibility" to submit to Mantys API
8. **Close Sidebar**: Click Cancel, X button, press Escape, or click backdrop to close

### Data Pre-filling

The form intelligently pre-fills data from:

```typescript
// Patient Data
- Name: firstname + middlename + lastname
- Phone: phone || home_phone || phone_other
- Emirates ID: uid_value

// Insurance Data
- TPA Name: Mapped from tpa_name to TPA codes
- Member ID: tpa_policy_id
- Payer Name: payer_name
```

### TPA Mapping

The form includes intelligent mapping from insurance names to TPA codes:

```typescript
"Neuron" → "TPA001"
"NextCare" → "TPA002"
"Al Madallah" → "TPA003"
"NAS" → "TPA004"
"Daman" → "INS026"
"AXA" → "INS010"
"ADNIC" → "INS017"
// ... and more
```

## Key Features

### 1. Dynamic ID Types

ID type options change based on selected TPA:
- **Base**: Emirates ID, Member ID
- **FMC (TPA010)**: + DHA Member ID, Passport
- **NextCare/Lifeline**: + DHA Member ID, Policy Number
- **Many others**: + DHA Member ID

### 2. Visit Types

Visit type options vary by TPA:
- **Most TPAs**: Outpatient, Emergency
- **NextCare**: + Chronic Out
- **NAS/Neuron**: + Maternity (with sub-types)
- **AXA**: + Dental

### 3. Conditional Fields

Fields appear/disappear based on:
- Selected TPA
- Organization ID
- ID Type
- Visit Type

Examples:
- **Doctor Name**: Required for Daman, eCare, Daman Thiqa
- **Phone**: Required for eCare, Daman, Daman Thiqa, Lifeline@AlNoor
- **POD Fields**: Only for Daman/Thiqa at Medcare/HealthHub
- **Split Phone**: Only for ADNIC at Org1
- **Service Type**: Only for eCare, Lifeline@AlNoor

### 4. Smart Validation

- **Emirates ID Format**: XXX-XXXX-XXXXXXX-X (15 digits, auto-formatted)
- **DHA Member ID**: XXXX-XXX-XXXXXXXXX-XX (alphanumeric, auto-formatted)
- **Warning Messages**: Helpful hints when format is incorrect
- **Required Field Validation**: Based on TPA and context

### 5. Auto-Selection Logic

- **Visit Type**: Auto-selects appropriate visit type when TPA changes
- **AXA Dental**: Auto-switches to Member ID when Dental visit type selected
- **NextCare**: Different default visit type based on organization

## API Integration

Currently, the form logs the payload to console. To integrate with Mantys API:

```typescript
// In MantysEligibilityForm.tsx, handleSubmit function:

const response = await fetch('/api/mantys/eligibility-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})

const result = await response.json()
// Handle response
```

### Expected Payload Structure

```json
{
  "emirates_id": "784-1234-1234567-1",
  "tpa_name": "TPA002",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "phone": "971-50-1234567",
  "practice_id": "clinic-1",
  "name": "John Doe",
  "doctor_name": "DR001",
  // ... other conditional fields
}
```

## Testing

### Test Scenarios

1. **Basic Flow**:
   - Search for patient
   - View insurance details
   - Click "Check Eligibility"
   - Verify pre-filled data
   - Submit form

2. **Different TPAs**:
   - Try Daman (should show POD fields if at Medcare/HealthHub)
   - Try NextCare with Policy Number (should show Payer Name)
   - Try NAS/Neuron with Maternity visit type (should show maternity type options)
   - Try AXA (should show Dental option)

3. **Validation**:
   - Try submitting with empty required fields
   - Try invalid Emirates ID format
   - Try invalid DHA Member ID format

## Dependencies

### New Dependencies Installed

```json
{
  "react-select": "^latest",
  "@types/react-select": "^latest"
}
```

## Customization

### Organization ID

Currently hardcoded to "medcare". To make it dynamic:

```typescript
// In MantysEligibilityForm.tsx
interface MantysEligibilityFormProps {
  patientData: PatientData | null
  insuranceData: InsuranceData | null
  onClose?: () => void
  organizationId?: string  // Add this
  clinicId?: string        // Add this
}

// Then use props instead of hardcoded values
const selectedOrganizationId = organizationId || "medcare"
const selectedClinicId = clinicId || "clinic-1"
```

### Adding More TPAs

To add more insurance providers:

1. Add to `INSURANCE_OPTIONS` array
2. Add visit types to `VISIT_TYPES` object
3. Add conditional logic for any special fields
4. Update TPA mapping in pre-fill logic

### Customizing Fields

To add/modify conditional fields:

1. Add state variable for the field
2. Add logic to show/hide field based on conditions
3. Add validation if required
4. Include in payload if present

## Business Rules Implemented

### POD (Point of Delivery)

- Only for: Daman (INS026), Daman Thiqa (TPA023), Daman Variant (D004)
- Only at: Medcare, HealthHub
- Fields: POD Yes/No, POD ID, Maternity flag, Chief complaint checkbox

### Doctor Name

Required for:
- Daman (INS026)
- eCare (TPA029)
- Daman variant (D004)
- Daman Thiqa (TPA023)
- All providers (BOTH, DHPO, RIYATI)
- Organization-specific: Lifeline@AlNoor, Neuron@Org1, ADNIC@Org1, NAS@Org1

### Phone Number

Required for:
- eCare (TPA029)
- Daman Thiqa (TPA023)
- Daman variant (D004)
- Lifeline@AlNoor
- Daman (INS026)
- AXA with non-Emirates ID and Dental

### Maternity Types

Available for: NAS (TPA004), Neuron (TPA001)

Options:
- Normal Delivery
- C-Section
- Prenatal
- Postnatal

## Files Modified/Created

### Created
- `renderer/components/MantysEligibilityForm.tsx` (1000+ lines)
- `renderer/components/ui/sidebar.tsx` (Reusable sidebar component)

### Modified
- `renderer/components/InsuranceDetailsSection.tsx`
- `renderer/components/PatientDetailsDisplay.tsx`
- `package.json` (added react-select dependency)

## Next Steps

1. **API Integration**: Connect to actual Mantys API endpoint
2. **Response Handling**: Display eligibility check results
3. **Error Handling**: Show appropriate error messages
4. **Loading States**: Add loading indicators during API calls
5. **History Tracking**: Store eligibility check history
6. **Organization Context**: Make organization ID dynamic from user context
7. **Doctor List**: Fetch real doctors list from API
8. **Validation Enhancement**: Add server-side validation

## Support

For questions or issues:
1. Check console logs for payload structure
2. Verify patient and insurance data is loaded correctly
3. Check TPA mapping for insurance provider recognition
4. Review conditional field logic for specific TPAs

---

**Status**: ✅ Fully Integrated and Ready for Testing
**Next**: API Integration with Mantys Backend

