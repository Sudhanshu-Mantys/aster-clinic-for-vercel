# Mantys API Payload Quick Reference

Quick reference for building payloads for different TPAs based on official specifications.

---

## Clinic IDs

```typescript
ASTER: "92d5da39-36af-4fa2-bde3-3828600d7871"
```

---

## Key Response Fields

### Network (Card Type)
```typescript
data.policy_network.all_networks[0].network
// Example values: "WN", "GN", "SN"
```

### Copay Details
```typescript
data.copay_details_to_fill
// Array of categories: Outpatient, Maternity, Specialization, Inpatient
```

### Member ID
```typescript
data.patient_info.policy_primary_member_id
```

---

## TPA Payloads

### 1. NAS (TPA004)

**Basic Payload:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA004",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "extra_args": {
    "title": "",
    "value": ""
  },
  "doctorName": "",
  "payerName": ""
}
```

**Visit Types:**
```json
[
  "OUTPATIENT",
  "INPATIENT",
  "DENTAL",
  "OPTICAL",
  "MATERNITY",
  "PSYCHIATRY",
  "WELLNESS"
]
```

**Maternity Special Case:**
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
  },
  "doctorName": "",
  "payerName": ""
}
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER", "DHAMEMBERID"]
```

---

### 2. Neuron (TPA001)

**Basic Payload:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA001",
  "id_type": "EMIRATESID",
  "visit_type": "PSYCHIATRY",
  "extra_args": {
    "title": "",
    "value": ""
  },
  "doctorName": "",
  "payerName": ""
}
```

**Visit Types:**
```json
[
  "OUTPATIENT",
  "INPATIENT",
  "DENTAL",
  "OPTICAL",
  "MATERNITY",
  "PSYCHIATRY",
  "WELLNESS"
]
```

**Maternity Special Case:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA001",
  "id_type": "EMIRATESID",
  "visit_type": "MATERNITY",
  "extra_args": {
    "title": "maternity_treatment",
    "value": "YES"
  },
  "doctorName": "",
  "payerName": ""
}
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER", "DHAMEMBERID"]
```

---

### 3. Mednet (TPA036)

**Basic Payload:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA036",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "doctorName": "",
  "payerName": ""
}
```

**Visit Types:**
```json
["OUTPATIENT", "EMERGENCY"]
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER", "DHAMEMBERID"]
```

---

### 4. Oman / Sukoon (INS012)

**Basic Payload:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "INS012",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "doctorName": "",
  "payerName": ""
}
```

**Visit Types:**
```json
["OUTPATIENT"]
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER"]
```

---

### 5. eCare (TPA029)

**Basic Payload:**
```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA029",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "doctorName": "DHA-P-0197432",
  "payerName": ""
}
```

**Note:** `doctorName` is the DHA license ID of the doctor. Can be skipped if claim form is not needed.

**Visit Types:**
```json
["OUTPATIENT", "INPATIENT"]
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER"]
```

---

### 6. NextCare (TPA002)

**With Policy Number:**
```json
{
  "id_value": "POL123456",
  "tpa_name": "TPA002",
  "id_type": "POLICYNUMBER",
  "visit_type": "CHRONIC_OUT",
  "name": "RANEESH",
  "payerName": "Adamjee Ins Co Ltd"
}
```

**Note:** `name` and `payerName` are only needed when using POLICYNUMBER as ID type.

**Visit Types:**
```json
[
  "INPATIENT",
  "OUTPATIENT",
  "DENTAL",
  "LIFE",
  "OPTICAL",
  "TRAVEL_INSURANCE",
  "CHRONIC_OUT",
  "EMERGENCY",
  "MATERNITY"
]
```

**ID Types:**
```json
["EMIRATESID", "CARDNUMBER", "DHAMEMBERID", "POLICYNUMBER"]
```

**Payer Options (for POLICYNUMBER):**
```javascript
[
  "Abu Dhabi National Insurance Company - UAE",
  "Abu Dhabi National Takaful Company",
  "Adamjee Ins Co Ltd",
  "Al Ahlia Insurance Co.",
  "AL BARAMI GROUP - Oman",
  "Al Buhaira National Ins. - Repatriation / Travel",
  "Al Buhaira National Ins.- AGA Emergency Evacuation",
  "Al Buhairah National Insurance Company",
  "Al Buhairah National Insurance Company (New)",
  "Al Dhafra Insurance Company PSC",
  "Al Fujairah National Insurance Company PJSC",
  // ... (200+ more payers - see full list in MANTYS_API_INTEGRATION.md)
]
```

---

## Sample Response Structure

```json
{
  "tpa": "TPA004",
  "data": {
    "payer_id": "TPA004",
    "is_eligible": true,
    "job_task_id": "job-123",
    "patient_info": {
      "patient_id_info": {
        "client_number": "CLIENT123",
        "dha_member_id": null,
        "policy_number": "POL123",
        "tpa_member_id": "TPA00412345",
        "reference_number": "REF123"
      },
      "policy_holder_dob": "1990-01-01",
      "policy_holder_name": "John Doe",
      "patient_emirates_id": "784-1234-1234567-1",
      "policy_holder_phone": null,
      "policy_holder_gender": "Male",
      "policy_primary_member_id": "TPA00412345",
      "policy_holder_relationship": null,
      "policy_holder_date_of_birth": "1990-01-01",
      "policy_primary_dha_member_id": "Not Available"
    },
    "policy_network": {
      "is_vip": "Not Mentioned",
      "payer_name": "DUBAI INSURANCE COMPANY - INS005",
      "sponsor_id": "CLIENT123",
      "start_date": "2025-06-13",
      "valid_upto": "2026-06-12",
      "all_networks": [
        {
          "network": "WN",
          "visit_type": "OP (Out Patient)",
          "network_value": "Workers Network",
          "matched_plan_name": null,
          "network_name_as_in_text": "Workers Network [Applicable Tariff: Workers Network]"
        }
      ],
      "package_name": null,
      "is_gatekeeper": "Not Mentioned",
      "waiting_period": null,
      "policy_authority": "DOH",
      "policy_plan_name": null,
      "work_site_covered": "Could not determine",
      "policy_holder_name": null
    },
    "copay_details_to_fill": [
      {
        "name": "Outpatient",
        "values_to_fill": {
          "LAB": {
            "copay": "20.0",
            "deductible": "50.0",
            "should_set_copay": true
          },
          "MEDICINES": {
            "copay": "30.0",
            "deductible": "0",
            "should_set_copay": true
          },
          "PROCEDURE": {
            "copay": "0",
            "deductible": "0",
            "should_set_copay": true
          },
          "RADIOLOGY": {
            "copay": "20.0",
            "deductible": "50.0",
            "should_set_copay": true
          },
          "CONSULTATION": {
            "copay": "0",
            "deductible": "20.0",
            "should_set_copay": false
          },
          "DENTAL CONSULTATION & PROCEDURE": {
            "copay": "0",
            "deductible": "0",
            "should_set_copay": true
          }
        },
        "primary_network": {
          "network": "WN",
          "network_status": null,
          "matched_plan_name": null
        },
        "available_networks": [
          {
            "network": "WN",
            "visit_type": "OP (Out Patient)",
            "network_value": "Workers Network",
            "matched_plan_name": null,
            "network_name_as_in_text": "Workers Network [Applicable Tariff: Workers Network]"
          }
        ],
        "has_multiple_networks": false
      }
    ],
    "copay_analysis": {
      "copay_details": [],
      "waiting_period": "Not Specified",
      "special_remarks": [
        "Pre-approval required for aggregate net amount 700.0 AED or above",
        "Pre-approval required for: Acute Drugs, C.T Scan, Child Vaccinations",
        "No referral required for specialist consultation"
      ]
    },
    "referral_documents": [
      {
        "tag": "Member Eligibility - Main Page",
        "s3_url": "https://s3.amazonaws.com/..."
      },
      {
        "tag": "Member Eligibility - Details Modal",
        "s3_url": "https://s3.amazonaws.com/..."
      },
      {
        "id": "claim_form",
        "tag": "Consultation/Claim form",
        "s3_url": "https://s3.amazonaws.com/..."
      }
    ]
  },
  "status": "found",
  "job_task_id": "job-123"
}
```

---

## Using in Code

### TypeScript Example

```typescript
import { buildMantysPayload, checkMantysEligibility } from '@/lib/api'

// NAS Outpatient
const payload = buildMantysPayload({
  idValue: "784-1234-1234567-1",
  phone: "971-50-1234567",
  tpaName: "TPA004",
  idType: "EMIRATESID",
  visitType: "OUTPATIENT",
  clinicId: "92d5da39-36af-4fa2-bde3-3828600d7871"
})

const response = await checkMantysEligibility(payload)

// Extract key fields
console.log("Network:", response.data.policy_network.all_networks[0].network)
console.log("Member ID:", response.data.patient_info.policy_primary_member_id)
console.log("Copay Details:", response.data.copay_details_to_fill)
```

---

## Common Patterns

### Pattern 1: Basic Check (Most TPAs)
```typescript
{
  id_value: "784-1234-1234567-1",
  phone: "971-50-1234567",
  tpa_name: "TPA_CODE",
  id_type: "EMIRATESID",
  visit_type: "OUTPATIENT"
}
```

### Pattern 2: With Maternity (NAS, Neuron)
```typescript
{
  id_value: "784-1234-1234567-1",
  phone: "971-50-1234567",
  tpa_name: "TPA004",
  id_type: "EMIRATESID",
  visit_type: "MATERNITY",
  extra_args: {
    title: "maternity_treatment",
    value: "YES"  // or "NO" for prenatal/postnatal
  }
}
```

### Pattern 3: With Doctor (eCare)
```typescript
{
  id_value: "784-1234-1234567-1",
  phone: "971-50-1234567",
  tpa_name: "TPA029",
  id_type: "EMIRATESID",
  visit_type: "OUTPATIENT",
  doctorName: "DHA-P-0197432"  // DHA license number
}
```

### Pattern 4: With Policy Number (NextCare)
```typescript
{
  id_value: "POL123456",
  tpa_name: "TPA002",
  id_type: "POLICYNUMBER",
  visit_type: "CHRONIC_OUT",
  name: "John Doe",
  payerName: "Adamjee Ins Co Ltd"
}
```

---

## Phone Number Formats

All phone numbers should be in the format:
```
971-XX-XXXXXXX
```

Examples:
- `971-50-1234567`
- `971-52-9876543`
- `971-54-1112233`

---

## Emirates ID Format

Format: `XXX-XXXX-XXXXXXX-X`

Example: `784-1234-1234567-1`

Must be exactly 15 digits with dashes in the specified positions.

---

## DHA Member ID Format

Format: `XXXX-XXX-XXXXXXXXX-XX` (alphanumeric)

Example: `1234-ABC-123456789-01`

Can contain letters and numbers.

---

**Last Updated:** November 28, 2025
**Reference:** Official Mantys API Specifications

