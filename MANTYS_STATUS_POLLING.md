# Mantys Status Polling Implementation

## Overview
Implemented a real-time status polling system for Mantys eligibility checks with support for up to 5-minute processing times.

## Architecture

### 1. **Task Creation Endpoint** (`/api/mantys/eligibility-check`)
- Creates a task with the Mantys API
- Returns immediately with `task_id` (HTTP 202)
- Does NOT wait for completion

**Response:**
```json
{
  "task_id": "uuid",
  "message": "Task created successfully",
  "status": "pending"
}
```

### 2. **Status Check Endpoint** (`/api/mantys/check-status`)
- Polls the Mantys result endpoint
- Returns current status and progress information
- Handles multiple states: pending, processing, complete, error

**Request:**
```json
{
  "task_id": "uuid"
}
```

**Response States:**

**a) Pending:**
```json
{
  "status": "pending",
  "taskStatus": "IN_QUEUE",
  "message": "Task is being processed..."
}
```

**b) Processing:**
```json
{
  "status": "processing",
  "taskStatus": "EXTRACTING_DATA",
  "message": "Extracting eligibility data...",
  "interimResults": {
    "screenshot": "s3_url",
    "documents": [...]
  }
}
```

**c) Complete:**
```json
{
  "status": "complete",
  "taskStatus": "PROCESS_COMPLETE",
  "message": "Eligibility check complete",
  "result": {
    "tpa": "TPA002",
    "data": {...},
    "status": "found",
    "job_task_id": "uuid",
    "task_id": "uuid"
  }
}
```

### 3. **Frontend Polling** (`MantysEligibilityForm.tsx`)

**Flow:**
1. User clicks "Check Eligibility"
2. Frontend calls `/api/mantys/eligibility-check` to create task
3. Frontend receives `task_id` and starts polling
4. Polls `/api/mantys/check-status` every 2 seconds
5. Updates UI with status messages
6. Stops when complete or after 150 attempts (5 minutes)

**UI Updates:**
- Shows current status message
- Displays polling attempt count (e.g., "Attempt 45/150")
- Shows max timeout (5 minutes)
- Updates progress in real-time

## Configuration

### Timeout Settings
- **Poll Interval:** 2 seconds
- **Max Attempts:** 150
- **Total Timeout:** 5 minutes (150 × 2 seconds)

### API Credentials
```env
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
MANTYS_CLIENT_ID=aster-clinic
MANTYS_CLINIC_ID=92d5da39-36af-4fa2-bde3-3828600d7871
```

## Status Messages

| State | Message |
|-------|---------|
| Creating | "Creating eligibility check task..." |
| Queued | "Task queued, waiting to start..." |
| Processing | "Extracting eligibility data from TPA portal..." |
| Complete | "Eligibility check complete!" |
| Timeout | "Eligibility check timed out after 5 minutes" |

## Task States from Mantys API

| Status | Description |
|--------|-------------|
| `IN_QUEUE` | Task is queued, not yet started |
| `EXTRACTING_DATA` | Bot is scraping TPA portal |
| `PROCESS_COMPLETE` | Task finished, results available |

## Error Handling

1. **Task Creation Failure:** Returns error immediately
2. **Polling Failure:** Continues polling unless critical error
3. **Timeout:** Shows timeout message after 5 minutes
4. **Member Not Found:** Returns complete with error status

## Future Enhancements

1. **WebSocket Support:** Real-time push instead of polling
2. **Progress Bar:** Visual progress indicator
3. **Interim Results Display:** Show screenshot during processing
4. **Cancel Operation:** Allow user to cancel long-running tasks
5. **Retry Logic:** Automatic retry on transient failures

## Testing

To test the implementation:

1. Start the development server
2. Navigate to a patient with insurance
3. Click "Check Eligibility with Mantys"
4. Observe status updates in real-time
5. Wait for completion (typically 30-90 seconds)

## Files Modified

1. `/renderer/pages/api/mantys/eligibility-check.ts` - Task creation
2. `/renderer/pages/api/mantys/check-status.ts` - Status polling (NEW)
3. `/renderer/components/MantysEligibilityForm.tsx` - Frontend polling
4. `/renderer/types/mantys.ts` - Type definitions updated


