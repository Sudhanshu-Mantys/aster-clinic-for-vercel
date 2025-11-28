# Mantys API - Official Documentation

This document reflects the official Mantys API specification for Aster Clinic.

---

## Authentication

Mantys API uses API_KEY to access various endpoints.

**Contact**: [`kriti@mantys.io`](mailto:kriti@mantys.io) to request an API key

**Your Credentials:**
- **API Key**: `api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab`
- **Base URL**: `https://aster.api.mantys.org`
- **Clinic ID**: `92d5da39-36af-4fa2-bde3-3828600d7871`

**Usage:**
```bash
curl -H "Authorization: Bearer api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab" \
  https://aster.api.mantys.org/api/v1/create-task
```

---

## API Response Format

### Valid Server Response

```json
{
  "data": [],
  "status": "success",
  "status_code": 200
}
```

### Error Response

```json
{
  "status_code": 400,
  "message": "Validation Failed.",
  "error_code": "UNAUTHORIZED" 
}
```

### Status Codes

| Status Code | Description | Most Likely Cause |
|-------------|-------------|-------------------|
| 2XX | Successful Request | - |
| 400 | Bad Request | Invalid/missing data |
| 401 | Unauthorised | Invalid/missing credentials |
| 404 | Not Found | Resource does not exist |
| 429 | Too Many Requests | Hit an API rate limit |
| 50X | Server error | Internal server issue |

---

## Rate Limits

**For all API endpoints:**
- Maximum: **30 eligibility requests per minute**
- Exceeding this limit will result in HTTP 429 responses

---

## Endpoints

### 1. Create Task

**Endpoint:** `POST /v2/api-integration/create-task`

**Description:** Initiates an eligibility check task. Returns a task_id for polling.

#### Request Payload

```json
{
  "id_value": "<VALID ID>",
  "id_type": "<EMIRATESID | CARDNO | DHAMEMBERID>",
  "phone": "<971-5XXXXXXX>",
  "practice_id": "<ID_FOR_THE_CLINIC>",
  "tpa_id": "<VALID TPA ID>",
  "visit_type": "<OUTPATIENT | INPATIENT | EMERGENCY>",
  "doctorName": "<Dr. John Doe>"
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_value` | string | ✅ Yes | Patient identifier (Emirates ID, Card Number, or DHA Member ID) |
| `id_type` | string | ✅ Yes | Type of ID: `EMIRATESID`, `CARDNO`, or `DHAMEMBERID` |
| `phone` | string | ⚠️ Optional | Patient's mobile number (format: 971-5XXXXXXX) |
| `practice_id` | string | ✅ Yes | UUID of the clinic (your ID: `92d5da39-36af-4fa2-bde3-3828600d7871`) |
| `tpa_id` | string | ✅ Yes | TPA identifier (e.g., TPA003, TPA004, BOTH) |
| `visit_type` | string | ✅ Yes | Type of visit: `OUTPATIENT`, `INPATIENT`, or `EMERGENCY` |
| `doctorName` | string | ⚠️ Optional | Doctor's full name (required for DAMAN or ECARE claim forms) |

#### Example Request

```bash
curl -X POST https://aster.api.mantys.org/v2/api-integration/create-task \
  -H "Authorization: Bearer api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab" \
  -H "Content-Type: application/json" \
  -d '{
    "id_value": "784-1234-1234567-1",
    "id_type": "EMIRATESID",
    "phone": "971-50-1234567",
    "practice_id": "92d5da39-36af-4fa2-bde3-3828600d7871",
    "tpa_id": "TPA004",
    "visit_type": "OUTPATIENT"
  }'
```

#### Response

```json
{
  "message": "Task initiated",
  "task_id": "2ee93b2a-5dbf-4653-bc33-lorem"
}
```

---

### 2. Read Status / Results

**Endpoint:** `POST /v2/api-integration/task-result`

**Description:** Retrieves the status and results of a previously created task. Poll this endpoint until results are available.

#### Request Payload

```json
{
  "task_id": "2ee93b2a-5dbf-4653-bc33-ipsum"
}
```

#### Example Request

```bash
curl -X POST https://aster.api.mantys.org/v2/api-integration/task-result \
  -H "Authorization: Bearer api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "2ee93b2a-5dbf-4653-bc33-ipsum"
  }'
```

#### Response Format

```json
{
  "search_id": "<EMIRATES_ID>",
  "data_dump": {
    "tpa": "<TPA_ID>",
    "data": {
      "payer_id": "<TPA_ID>",
      "is_eligible": true,
      "job_task_id": "<JOB_TASK_UUID>",
      "patient_info": {
        "patient_id_info": {
          "member_number": "<MEMBER_NUMBER>"
        },
        "policy_holder_dob": "<DOB_STRING>",
        "policy_holder_name": "<FULL_NAME>",
        "patient_emirates_id": "<EMIRATES_ID>",
        "policy_holder_phone": "<PHONE_NUMBER_OR_NULL>",
        "policy_holder_gender": "<GENDER>",
        "policy_primary_member_id": "<MEMBER_ID>",
        "policy_holder_relationship": "<RELATIONSHIP_OR_NULL>",
        "policy_holder_date_of_birth": "<DOB_STRING>",
        "policy_primary_dha_member_id": "<DHA_MEMBER_ID_OR_NOT_AVAILABLE>"
      },
      "copay_analysis": {
        "copay_details": [],
        "waiting_period": "<WAITING_PERIOD>",
        "special_remarks": ["<REMARK_STRING>"],
        "new_version_of_copay_analysis": {
          "benefits": [],
          "policy_info": {
            "waiting_period": "<WAITING_PERIOD>",
            "policy_period_end": {
              "DD": 31,
              "MM": 12,
              "YYYY": 2025
            },
            "policy_jurisdiction": "<AUTHORITY>",
            "policy_period_start": {
              "DD": 1,
              "MM": 1,
              "YYYY": 2025
            },
            "beneficiary_start_date": "<DATE_OR_NULL>"
          },
          "general_remarks": ["<REMARK_STRING>"],
          "abbreviations_defined": [
            {
              "definition": "<FULL_TERM>",
              "abbreviation": "<SHORT_FORM>"
            }
          ]
        }
      },
      "failure_reason": null,
      "policy_network": {
        "is_vip": "<BOOLEAN_OR_STRING>",
        "payer_name": "<INSURANCE_COMPANY_NAME>",
        "start_date": "<START_DATE>",
        "valid_upto": "<EXPIRY_DATE>",
        "all_networks": [
          {
            "network": "<NETWORK_CODE>",
            "visit_type": "<VISIT_TYPE>",
            "network_value": "<VALUE>",
            "matched_plan_name": "<PLAN_NAME_OR_NULL>",
            "network_name_as_in_text": "<RAW_TEXT>"
          }
        ],
        "package_name": "<PACKAGE_OR_NULL>",
        "is_gatekeeper": "<BOOLEAN_OR_STRING>",
        "waiting_period": "<WAITING_PERIOD>",
        "policy_authority": "<AUTHORITY>",
        "policy_plan_name": "<PLAN_NAME_OR_NULL>",
        "work_site_covered": "<YES_NO_UNKNOWN>",
        "policy_holder_name": "<NAME_OR_NULL>",
        "gatekeeper_citations": "<CITATION_OR_NULL>",
        "policy_authority_citation": "<AUTHORITY_CITATION>"
      },
      "screenshot_key": "<S3_SIGNED_URL>",
      "policy_holder_dob": "<DOB_STRING>",
      "policy_holder_name": "<FULL_NAME>",
      "referral_documents": [
        {
          "id": "<DOC_ID>",
          "tag": "<DOC_LABEL>",
          "s3_url": "<S3_SIGNED_URL>"
        }
      ],
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
            }
          },
          "primary_network": {
            "network": "WN"
          }
        }
      ],
      "policy_holder_emirates_id": "<EMIRATES_ID>",
      "was_identified_by_aggregator": false
    },
    "status": "found",
    "job_task_id": "<JOB_TASK_UUID>"
  },
  "task_id": "<TASK_UUID>",
  "status": "found",
  "clinic_id": "<CLINIC_UUID>",
  "updated_at": "<UPDATED_ISO_TIMESTAMP>",
  "tpa_name": "<TPA_NAME_OR_NULL>",
  "id": "<RECORD_UUID>",
  "user_id": "<USER_UUID>",
  "tenant_id": "<TENANT_ID>",
  "created_at": "<CREATED_ISO_TIMESTAMP>"
}
```

#### Key Response Fields

| Field | Description |
|-------|-------------|
| `search_id` | Emirates ID used for verification |
| `data_dump.data.is_eligible` | Boolean indicating eligibility status |
| `data_dump.data.patient_info` | Patient demographic and policy data |
| `data_dump.data.copay_details_to_fill` | Copay/deductible breakdown per service type |
| `data_dump.data.policy_network` | Network tier and plan information |
| `data_dump.data.referral_documents` | PDF links for forms |
| `status` | Overall task status: `found` or `not_found` |

---

## Two-Step Workflow

The Mantys API uses a two-step process:

### Step 1: Create Task
```
POST /v2/api-integration/create-task
↓
Returns task_id
```

### Step 2: Poll for Results
```
POST /v2/api-integration/task-result (with task_id)
↓
Poll every 2-3 seconds until results are ready
↓
Returns eligibility data
```

**Recommended Polling Strategy:**
- Poll every 2 seconds
- Maximum 30 attempts (60 seconds total)
- Show loading indicator to user during polling

---

## Our Implementation

The integration automatically handles the two-step process:

1. **User submits form** → Calls `/api/mantys/eligibility-check`
2. **Our API endpoint** → Creates task with Mantys
3. **Our API endpoint** → Polls for results automatically
4. **User sees results** → Displays eligibility information

**You don't need to manually implement the polling logic** - it's built into the API endpoint!

---

## Webhooks (In Development)

Mantys is adding webhook support to notify practices upon task completion. This will eliminate the need for polling.

**When available:**
- Register your webhook URL
- Receive automatic notifications when tasks complete
- Process results immediately

---

## Rate Limiting Best Practices

To stay within the 30 requests/minute limit:

1. **Debounce form submissions** - Prevent accidental double-clicks
2. **Cache results** - Store recent checks for a few minutes
3. **Show progress indicators** - Prevent users from re-submitting
4. **Handle 429 errors** - Show friendly message and retry after 1 minute

---

## Testing

### Test with Real Patient Data

1. Use actual patient Emirates IDs
2. Use real TPA codes (TPA004, TPA002, etc.)
3. Verify results match insurance cards

### Expected Response Times

- Task creation: < 1 second
- Results available: 5-15 seconds typically
- Maximum wait: 60 seconds (then timeout)

---

## Support

**Technical Issues:**
- Email: [`kriti@mantys.io`](mailto:kriti@mantys.io)
- Include your API key and task_id for faster support

**Your Account Details:**
- **Clinic**: Aster Clinic
- **API Key**: `api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab`
- **Clinic ID**: `92d5da39-36af-4fa2-bde3-3828600d7871`

---

**Documentation Version:** 1.0  
**Last Updated:** November 28, 2025  
**API Version:** v1

