# Insurance Details Implementation

## Overview
Added functionality to automatically fetch and display insurance details when a patient is selected in the dashboard.

## Files Modified/Created

### 1. New API Endpoint: `renderer/pages/api/patient/insurance-details.ts`
- Created a new Next.js API route to proxy requests to the Mantys API
- Endpoint: `/claim/insurance/details/replicate/get`
- Accepts patient ID and returns insurance details
- Includes proper error handling and logging

### 2. API Library: `renderer/lib/api.ts`
- Added `InsuranceData` interface to define the structure of insurance records
- Added `InsuranceDetailsResponse` interface for the API response
- Added `getInsuranceDetails(patientId)` function to fetch insurance data

### 3. Dashboard: `renderer/pages/dashboard.tsx`
- Added state management for insurance details:
  - `insuranceDetails`: stores the insurance records
  - `isLoadingInsurance`: tracks loading state
  - `insuranceError`: stores any error messages
- Added `fetchInsuranceDetails()` function to retrieve insurance data
- Added `useEffect` hook to automatically fetch insurance when a patient is selected
- Added UI section to display insurance details with:
  - Loading indicator
  - Error handling (shows friendly message if fetch fails)
  - Empty state (when no insurance records found)
  - Insurance cards showing:
    - TPA/Payer name (main heading)
    - Insurance plan name
    - Status badge (Active/Expired with color coding)
    - Valid badge (if insurance is currently valid)
    - TPA Policy ID
    - Payer name and code
    - Relationship to patient (Self, Spouse, etc.)
    - Rate card name
    - Authorization limit
    - Coverage period (From/Expires dates)
    - Copay details by charge group (Laboratory, Medicine, Radiology)
    - Deductible details

## User Flow

1. User searches for a patient (by MPI or Phone Number)
2. When patient is found and selected:
   - Patient details are displayed
   - Insurance details are automatically fetched
   - Insurance information appears in a dedicated section below patient info
   - **Active insurance policies are shown expanded**
   - **Expired insurance policies are shown collapsed** (minimized)
3. If multiple patients are found and user clicks one:
   - Same automatic insurance fetch occurs
4. User can click any insurance card to expand/collapse it:
   - Expired policies can be expanded to view full details
   - Active policies can be collapsed to save space
   - Smooth transition animations provide visual feedback

## API Request Format

```json
{
  "head": {
    "reqtime": "Fri Nov 28 2025",
    "srvseqno": "",
    "reqtype": "POST"
  },
  "body": {
    "apntId": null,
    "patientId": 4590999,
    "encounterId": 0,
    "customerId": 1,
    "primaryInsPolicyId": null,
    "siteId": 1,
    "isDiscard": 0,
    "hasTopUpCard": 0
  }
}
```

### Request Body Parameters

- `apntId`: Appointment ID (optional, defaults to null)
- `patientId`: Patient ID (required)
- `encounterId`: Encounter ID (optional, defaults to 0)
- `customerId`: Customer ID (optional, defaults to 1)
- `primaryInsPolicyId`: Primary Insurance Policy ID (optional, defaults to null)
- `siteId`: Site ID (optional, defaults to 1)
- `isDiscard`: Discard flag (optional, defaults to 0)
- `hasTopUpCard`: Top-up card flag (optional, defaults to 0)

## Features

- ✅ Automatic fetching when patient is selected
- ✅ Loading state with spinner
- ✅ Error handling with user-friendly messages
- ✅ Empty state when no insurance found
- ✅ Multiple insurance policies support
- ✅ Color-coded status badges (Active=green, Expired=red)
- ✅ Valid/Invalid indicators
- ✅ **Collapsible insurance cards** - Expired policies are minimized by default
  - Active policies: Auto-expanded to show full details
  - Expired policies: Collapsed showing only header with status
  - Click to expand/collapse any policy
  - Smooth animations and visual feedback
- ✅ Comprehensive insurance information display including:
  - TPA and Payer details
  - Policy information
  - Authorization limits
  - Coverage dates
  - Copay breakdown by charge group
  - Deductible information
- ✅ Responsive layout for insurance cards
- ✅ Deduplication of patient records based on patient_id

## Sample API Response Structure

The API returns detailed insurance information including:

```json
{
  "patient_insurance_tpa_policy_id": 7909490,
  "tpa_name": "NAS ADMINISTRATION SERVICES LIMITED",
  "tpa_policy_id": "3JMN-KN3F-LFLJ-6LED",
  "insurance_status": "Active",
  "is_valid": 1,
  "payer_name": "ABU DHABI NATIONAL INSURANCE COMPANY",
  "payer_code": "INS017",
  "ins_plan": "RN - NAS",
  "relation": "Self",
  "authorization_limit": "700.00",
  "insurance_from": "15-05-2025",
  "ins_exp_date": "2026-05-14",
  "copay": {
    "Default": {
      "copay_details": [...],
      "Deduct_details": [...]
    }
  }
}
```

## Additional Changes Made

- Changed default search type from "Patient ID" to "Phone Number"
- Removed Patient ID search option from UI (now only MPI and Phone Number)
- Added patient deduplication based on `patient_id` to prevent duplicate records in UI

