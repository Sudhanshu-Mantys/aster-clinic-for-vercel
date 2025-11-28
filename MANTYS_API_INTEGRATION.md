# Mantys API Integration Guide

This document provides comprehensive information about the Mantys TPA eligibility check integration in the Aster Clinics application.

## Table of Contents

1. [Overview](#overview)
2. [Clinic Configuration](#clinic-configuration)
3. [Supported TPAs](#supported-tpas)
4. [API Payload Structure](#api-payload-structure)
5. [Response Structure](#response-structure)
6. [Key Fields Extraction](#key-fields-extraction)
7. [Usage Examples](#usage-examples)
8. [Component Integration](#component-integration)

---

## Overview

The Mantys API integration allows the Aster Clinics application to check patient insurance eligibility across multiple Third Party Administrators (TPAs) in the UAE.

### Features

- ✅ Support for 30+ TPAs and Insurance Companies
- ✅ Real-time eligibility verification
- ✅ Automatic copay and deductible extraction
- ✅ Network information display
- ✅ Referral document access
- ✅ Special remarks and requirements
- ✅ Pre-filled form with patient data

---

## Clinic Configuration

### Clinic IDs

The application is configured for Aster Clinic:

```typescript
const CLINIC_IDS = {
  ASTER: "92d5da39-36af-4fa2-bde3-3828600d7871"
}
```

- **ASTER**: Aster Clinic

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
DEFAULT_CLINIC=ASTER
```

---

## Supported TPAs

### Major TPAs

| TPA Code | Name | ID Types | Visit Types |
|----------|------|----------|-------------|
| TPA001 | Neuron | EID, Card, DHA | OP, IP, Dental, Optical, Maternity, Psychiatry, Wellness |
| TPA002 | NextCare | EID, Card, DHA, Policy | OP, IP, Dental, Life, Optical, Travel, Chronic Out, Emergency, Maternity |
| TPA003 | Al Madallah | EID, Card | OP, Emergency |
| TPA004 | NAS | EID, Card, DHA | OP, IP, Dental, Optical, Maternity, Psychiatry, Wellness |
| TPA029 | eCare | EID, Card | OP, IP |
| TPA036 | Mednet | EID, Card, DHA | OP, Emergency |

### Insurance Companies

| Code | Name | ID Types | Visit Types |
|------|------|----------|-------------|
| INS012 | Oman Insurance / Sukoon | EID, Card | OP |
| INS010 | AXA Gulf Insurance | EID, Card, DHA | OP, Dental, Emergency |
| INS017 | ADNIC | EID, Card, DHA | OP, Emergency |
| INS026 | Daman | EID, Card | OP, Emergency |

---

## API Payload Structure

### Basic Structure

All TPA requests follow this basic structure:

```typescript
interface MantysEligibilityRequest {
  id_value: string        // Emirates ID, Member ID, etc.
  phone: string          // Format: "971-50-1234567"
  tpa_name: string       // TPA code (e.g., "TPA004")
  id_type: string        // "EMIRATESID", "CARDNUMBER", "DHAMEMBERID", "POLICYNUMBER"
  visit_type: string     // "OUTPATIENT", "INPATIENT", etc.
  clinic_id?: string     // Aster clinic ID
  extra_args?: {
    title: string
    value: string
  }
  doctorName?: string    // Required for specific TPAs
  payerName?: string     // Required for NextCare with Policy Number
  name?: string          // Required for NextCare with Policy Number
}
```

### TPA-Specific Examples

#### 1. NAS (TPA004)

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA004",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "clinic_id": "2a82dd66-5137-454f-bdc9-07d7c2c6dbbf"
}
```

**Maternity Example:**

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA004",
  "id_type": "EMIRATESID",
  "visit_type": "MATERNITY",
  "extra_args": {
    "title": "maternity_treatment",
    "value": "YES"
  }
}
```

#### 2. Neuron (TPA001)

Same structure as NAS. Supports maternity with extra_args.

#### 3. Mednet (TPA036)

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA036",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT"
}
```

**Visit Types:** OUTPATIENT, EMERGENCY only

#### 4. Oman Insurance / Sukoon (INS012)

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "INS012",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT"
}
```

**Visit Types:** OUTPATIENT only

#### 5. eCare (TPA029)

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA029",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "doctorName": "DHA-P-0197432"
}
```

**Note:** `doctorName` is the DHA license number. Can be skipped if claim form is not needed.

#### 6. NextCare (TPA002)

**With Emirates ID:**

```json
{
  "id_value": "784-1234-1234567-1",
  "tpa_name": "TPA002",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT"
}
```

**With Policy Number:**

```json
{
  "id_value": "POL123456",
  "tpa_name": "TPA002",
  "id_type": "POLICYNUMBER",
  "visit_type": "CHRONIC_OUT",
  "name": "John Doe",
  "payerName": "Adamjee Ins Co Ltd"
}
```

---

## Response Structure

### Success Response

```typescript
interface MantysEligibilityResponse {
  tpa: string
  status: "found" | "not_found" | "error"
  job_task_id: string
  data: {
    is_eligible: boolean
    payer_id: string
    
    // Patient Information
    patient_info: {
      policy_primary_member_id: string
      patient_emirates_id: string
      policy_holder_name: string
      policy_holder_dob: string
      policy_holder_gender: string
      // ... more fields
    }
    
    // Policy Network Information
    policy_network: {
      payer_name: string
      policy_authority: string  // "DOH", "DHA", etc.
      start_date: string
      valid_upto: string
      all_networks: Array<{
        network: string          // e.g., "WN" (Workers Network)
        network_value: string    // e.g., "Workers Network"
        visit_type: string
      }>
    }
    
    // Copay Details
    copay_details_to_fill: Array<{
      name: "Outpatient" | "Inpatient" | "Maternity" | "Specialization"
      values_to_fill: {
        LAB: { copay: string, deductible: string, should_set_copay: boolean }
        MEDICINES: { ... }
        PROCEDURE: { ... }
        RADIOLOGY: { ... }
        CONSULTATION: { ... }
        "DENTAL CONSULTATION & PROCEDURE": { ... }
      }
      primary_network: {
        network: string
      }
      available_networks: Array<...>
    }>
    
    // Special Remarks
    copay_analysis: {
      special_remarks: string[]
      waiting_period: string
      // ... more fields
    }
    
    // Referral Documents
    referral_documents: Array<{
      id?: string
      tag: string
      s3_url: string
    }>
  }
}
```

---

## Key Fields Extraction

The integration automatically extracts these key fields from the response:

### Network (Card Type)

```typescript
const network = data.policy_network.all_networks[0].network
// Example: "WN", "GN", "SN"
```

### Member ID

```typescript
const memberId = data.patient_info.policy_primary_member_id
```

### Copay Details

```typescript
const copayDetails = data.copay_details_to_fill
// Array of copay categories with detailed breakdowns
```

### Eligibility

```typescript
const isEligible = data.is_eligible
```

### Policy Dates

```typescript
const startDate = data.policy_network.start_date
const endDate = data.policy_network.valid_upto
```

---

## Usage Examples

### 1. Basic Eligibility Check

```typescript
import { checkMantysEligibility, buildMantysPayload } from '@/lib/api'

const payload = buildMantysPayload({
  idValue: "784-1234-1234567-1",
  phone: "971-50-1234567",
  tpaName: "TPA004",
  idType: "EMIRATESID",
  visitType: "OUTPATIENT",
  clinicId: "2a82dd66-5137-454f-bdc9-07d7c2c6dbbf"
})

const response = await checkMantysEligibility(payload)
```

### 2. Extracting Key Fields

```typescript
import { extractMantysKeyFields } from '@/lib/api'

const keyFields = extractMantysKeyFields(response)

console.log({
  network: keyFields.network,           // "WN"
  memberId: keyFields.memberId,         // "TPA00412345"
  isEligible: keyFields.isEligible,     // true
  payerName: keyFields.payerName,       // "Dubai Insurance Company"
  copayDetails: keyFields.copayDetails  // Array of copay categories
})
```

### 3. Displaying Results

```typescript
import { MantysResultsDisplay } from '@/components/MantysResultsDisplay'

<MantysResultsDisplay
  response={mantysResponse}
  onClose={handleClose}
  onCheckAnother={handleCheckAnother}
/>
```

---

## Component Integration

### 1. MantysEligibilityForm

The main form component for submitting eligibility checks.

**Props:**
- `patientData`: Patient information from Aster system
- `insuranceData`: Insurance information from Aster system
- `onClose`: Callback when closing the form

**Features:**
- Auto-prefills patient data
- Dynamic field visibility based on TPA
- Validates input formats
- Handles API submission

### 2. MantysResultsDisplay

Displays the eligibility check results in a user-friendly format.

**Props:**
- `response`: Mantys API response
- `onClose`: Callback when closing results
- `onCheckAnother`: Callback to check another eligibility

**Features:**
- Eligibility status with color coding
- Patient and policy information
- Expandable copay details tables
- Special remarks and warnings
- Referral document links
- Raw JSON viewer

### 3. InsuranceDetailsSection

Integrates the eligibility check button with insurance cards.

**Features:**
- "Check Eligibility with Mantys" button on active insurances
- Opens eligibility form in sidebar
- Auto-maps insurance TPA to Mantys TPA codes

---

## Error Handling

### Common Errors

1. **Missing API Key**
   ```
   Error: MANTYS_API_KEY is not configured
   ```
   Solution: Add `MANTYS_API_KEY` to `.env.local`

2. **Invalid ID Format**
   ```
   Error: Invalid Emirates ID format (must be XXX-XXXX-XXXXXXX-X)
   ```
   Solution: Ensure Emirates ID is properly formatted

3. **TPA Not Found**
   ```
   Status: not_found
   ```
   The patient is not eligible or ID is incorrect

4. **Network Error**
   ```
   Error: Failed to fetch
   ```
   Check network connection and API endpoint

---

## Testing

### Test Credentials

Use these test IDs for development (if provided by Mantys):

```typescript
const testIds = {
  emiratesId: "784-1234-1234567-1",
  memberId: "TEST123456",
  phone: "971-50-1234567"
}
```

### Debugging

Enable debug logging:

```typescript
// In mantys-utils.ts
console.log('Mantys Request:', payload)
console.log('Mantys Response:', response)
```

---

## API Endpoint

**Endpoint:** `/api/mantys/eligibility-check`

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:** See [API Payload Structure](#api-payload-structure)

**Response:** See [Response Structure](#response-structure)

---

## Next Steps

1. Configure your `.env.local` file with Mantys API credentials
2. Test with various TPAs using the form
3. Review the results display to ensure all data is shown correctly
4. Customize the UI as needed for your workflow

---

## Support

For issues or questions about the Mantys API:
- Check the Mantys API documentation
- Review the console logs for detailed error messages
- Contact Mantys support team

For issues with the integration:
- Review this documentation
- Check the component code in `/renderer/components/`
- Review the utility functions in `/renderer/lib/mantys-utils.ts`

---

**Last Updated:** November 28, 2025

