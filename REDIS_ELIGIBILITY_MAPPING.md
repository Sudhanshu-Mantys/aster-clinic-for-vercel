# Redis Eligibility Mapping

This document describes the Redis-based system for maintaining identifiers and connecting MPI (Master Patient Index) records with eligibility checks.

## Overview

The eligibility mapping system stores metadata about each eligibility check in Redis, allowing quick lookup of eligibility history by various patient identifiers:

- **MPI** (Master Patient Index)
- **Patient ID** (internal system ID)
- **Emirates ID**
- **Member ID** (insurance card number)

## Architecture

### Data Structure

Each eligibility check is stored with the following metadata:

```typescript
interface EligibilityCheckMetadata {
  taskId: string;              // Mantys task ID
  mpi: string;                 // Master Patient Index
  patientId: string | number;  // Internal patient ID
  patientName?: string;        // Patient name for reference
  emiratesId?: string;         // Emirates ID (if used)
  memberId?: string;           // Insurance member ID (if used)
  tpaCode: string;             // TPA/insurance provider code (e.g., "TPA036")
  idType: string;              // Type of ID used (EMIRATESID, CARDNUMBER, etc.)
  visitType: string;           // Visit type (OUTPATIENT, INPATIENT, etc.)
  status: "pending" | "processing" | "complete" | "error";
  createdAt: string;           // ISO timestamp
  completedAt?: string;        // ISO timestamp when completed
}
```

### Redis Key Patterns

The system uses multiple Redis keys to enable lookups from different identifiers:

| Key Pattern | Purpose | Data Type | TTL |
|------------|---------|-----------|-----|
| `eligibility:task:{taskId}` | Stores full metadata | String (JSON) | 90 days |
| `eligibility:mpi:{mpi}` | Set of taskIds for this MPI | Set | 90 days |
| `eligibility:patient:{patientId}` | Set of taskIds for this patient | Set | 90 days |
| `eligibility:emirates:{emiratesId}` | Set of taskIds for this Emirates ID | Set | 90 days |
| `eligibility:member:{memberId}` | Set of taskIds for this member ID | Set | 90 days |

### Example Redis Structure

```
# Metadata storage
eligibility:task:1cbb6d87-8021-49a4-8d69-3d8c87551c68
→ {"taskId":"1cbb6d87-8021-49a4-8d69-3d8c87551c68","mpi":"1004638444","patientId":"123456",...}

# MPI → taskIds mapping
eligibility:mpi:1004638444
→ Set: ["1cbb6d87-8021-49a4-8d69-3d8c87551c68", "2dcc7e98-9132-50b5-9e7a-4e9d98662d79"]

# Emirates ID → taskIds mapping
eligibility:emirates:784-1985-1234567-1
→ Set: ["1cbb6d87-8021-49a4-8d69-3d8c87551c68"]

# Member ID → taskIds mapping
eligibility:member:097113630394194402
→ Set: ["1cbb6d87-8021-49a4-8d69-3d8c87551c68"]
```

## API Integration

### 1. Creating an Eligibility Check

When creating a new eligibility check via `/api/mantys/eligibility-check`, include patient metadata:

**Request Body:**
```json
{
  "id_value": "784-1985-1234567-1",
  "id_type": "EMIRATESID",
  "tpa_name": "TPA036",
  "visit_type": "OUTPATIENT",
  
  // Patient metadata (stored in Redis, not sent to Mantys)
  "mpi": "1004638444",
  "patientId": "123456",
  "patientName": "Swati Gupta"
}
```

**Response:**
```json
{
  "task_id": "1cbb6d87-8021-49a4-8d69-3d8c87551c68",
  "message": "Task created successfully",
  "status": "pending"
}
```

The system automatically:
1. Creates the Mantys task
2. Stores metadata in Redis with all relevant identifier mappings
3. Returns the task ID for status polling

### 2. Retrieving Eligibility Checks

Four API endpoints allow retrieval by different identifiers:

#### By MPI
```
GET /api/eligibility/get-by-mpi?mpi=1004638444
```

#### By Patient ID
```
GET /api/eligibility/get-by-patient-id?patientId=123456
```

#### By Emirates ID
```
GET /api/eligibility/get-by-emirates-id?emiratesId=784-1985-1234567-1
```

#### By Member ID
```
GET /api/eligibility/get-by-member-id?memberId=097113630394194402
```

**Response Format (all endpoints):**
```json
{
  "success": true,
  "data": [
    {
      "taskId": "1cbb6d87-8021-49a4-8d69-3d8c87551c68",
      "mpi": "1004638444",
      "patientId": "123456",
      "patientName": "Swati Gupta",
      "emiratesId": "784-1985-1234567-1",
      "tpaCode": "TPA036",
      "idType": "EMIRATESID",
      "visitType": "OUTPATIENT",
      "status": "complete",
      "createdAt": "2025-12-11T10:30:00.000Z",
      "completedAt": "2025-12-11T10:32:15.000Z"
    }
  ]
}
```

Results are sorted by creation date (most recent first).

### 3. Status Updates

The `/api/mantys/check-status` endpoint automatically updates Redis when status changes:

- `pending` → `processing` (when EXTRACTING_DATA)
- `processing` → `complete` (when PROCESS_COMPLETE)

## Usage Examples

### Example 1: Store Eligibility Check with MPI

```typescript
import { eligibilityRedisService } from './lib/redis-eligibility-mapping';

await eligibilityRedisService.addEligibilityCheck({
  taskId: '1cbb6d87-8021-49a4-8d69-3d8c87551c68',
  mpi: '1004638444',
  patientId: '123456',
  patientName: 'Swati Gupta',
  emiratesId: '784-1985-1234567-1',
  tpaCode: 'TPA036',
  idType: 'EMIRATESID',
  visitType: 'OUTPATIENT',
  status: 'pending',
  createdAt: new Date().toISOString()
});
```

### Example 2: Retrieve All Checks for a Patient

```typescript
// Get all eligibility checks for this MPI
const checks = await eligibilityRedisService.getEligibilityChecksByMPI('1004638444');

console.log(`Found ${checks.length} eligibility checks`);
checks.forEach(check => {
  console.log(`- ${check.tpaCode} (${check.status}) - ${check.createdAt}`);
});
```

### Example 3: Get Latest Completed Check

```typescript
const latestCheck = await eligibilityRedisService.getLatestCompletedCheckByMPI('1004638444');

if (latestCheck) {
  console.log(`Latest check: ${latestCheck.tpaCode} on ${latestCheck.completedAt}`);
} else {
  console.log('No completed checks found');
}
```

### Example 4: Update Status

```typescript
await eligibilityRedisService.updateEligibilityStatus(
  '1cbb6d87-8021-49a4-8d69-3d8c87551c68',
  'complete',
  new Date().toISOString()
);
```

## Benefits

### 1. **Fast Lookups**
- O(1) lookup by any identifier (MPI, patient ID, Emirates ID, member ID)
- No database queries required for recent eligibility history

### 2. **Multi-Device Access**
- Unlike localStorage, Redis data is accessible from any device/browser
- Enables seamless cross-device workflows

### 3. **Automatic Expiration**
- 90-day TTL prevents indefinite storage
- Reduces storage costs and maintains relevance

### 4. **Relationship Tracking**
- Easily find all eligibility checks for a patient
- Track eligibility history across multiple TPAs
- Identify duplicate checks

### 5. **Status Monitoring**
- Real-time status updates stored centrally
- Monitor active/pending checks across all patients

## Data Retention

- **TTL**: 90 days for all keys
- **Auto-cleanup**: Redis automatically removes expired keys
- **Manual deletion**: Use `deleteEligibilityCheck(taskId)` to remove specific checks

## Error Handling

All Redis operations are wrapped in try-catch blocks and marked as non-fatal:

```typescript
try {
  await eligibilityRedisService.addEligibilityCheck(metadata);
} catch (redisError) {
  console.error('Failed to store in Redis (non-fatal):', redisError);
  // Continue - don't block eligibility check
}
```

This ensures that Redis failures don't prevent eligibility checks from functioning.

## Connection Management

The Redis client uses a singleton pattern with automatic reconnection:

- **Connection pooling**: Single client shared across requests
- **TLS enabled**: Secure connection to Azure Redis
- **Retry strategy**: Exponential backoff (50ms × attempts, max 2000ms)
- **Max retries**: 3 attempts per request

## Integration with Existing Systems

### With EligibilityHistoryService (localStorage)

The system complements the existing localStorage-based history:

| Feature | localStorage | Redis |
|---------|-------------|-------|
| Scope | Single browser | Cross-device |
| Capacity | Limited (~5MB) | Virtually unlimited |
| Persistence | User-specific | Clinic-wide |
| Speed | Instant | Network latency (~10-50ms) |
| Use Case | User session | Historical tracking |

**Recommendation**: Use both systems:
- localStorage for immediate UI state
- Redis for persistent cross-device history

### With MPI Search

When searching for a patient by MPI, fetch their recent eligibility checks:

```typescript
const patient = await searchPatientByMPI(mpi);
const eligibilityHistory = await fetch(`/api/eligibility/get-by-mpi?mpi=${mpi}`);

// Show both patient details and eligibility history
```

## Security Considerations

1. **No PHI in Redis**: Only metadata stored (no diagnosis, treatment details)
2. **TLS encryption**: All Redis connections use TLS
3. **Access control**: Redis requires authentication
4. **TTL enforcement**: Automatic data expiration after 90 days

## Monitoring & Debugging

### Check Redis Keys

```bash
# Connect to Redis CLI
redis-cli --tls -h prod0copay.redis.cache.windows.net -p 6380

# List all eligibility keys
KEYS eligibility:*

# Get metadata for specific task
GET eligibility:task:1cbb6d87-8021-49a4-8d69-3d8c87551c68

# Get all tasks for MPI
SMEMBERS eligibility:mpi:1004638444
```

### Logs

The system logs key operations:

```
Step 1: Creating Mantys task...
Step 2: Task created successfully, ID: 1cbb6d87-8021-49a4-8d69-3d8c87551c68
Step 3: Stored eligibility check in Redis
```

## Future Enhancements

Potential improvements:

1. **Analytics**: Track TPA success rates, average processing time
2. **Notifications**: Alert when eligibility expires or changes
3. **Caching**: Cache frequently accessed eligibility results
4. **Audit Trail**: Track who performed checks and when
5. **Bulk Operations**: Add/retrieve multiple checks in single call

## Files Modified/Created

### New Files
- `/renderer/lib/redis-eligibility-mapping.ts` - Core Redis service
- `/renderer/pages/api/eligibility/get-by-mpi.ts` - MPI lookup endpoint
- `/renderer/pages/api/eligibility/get-by-patient-id.ts` - Patient ID lookup endpoint
- `/renderer/pages/api/eligibility/get-by-emirates-id.ts` - Emirates ID lookup endpoint
- `/renderer/pages/api/eligibility/get-by-member-id.ts` - Member ID lookup endpoint

### Modified Files
- `/renderer/pages/api/mantys/eligibility-check.ts` - Added Redis storage
- `/renderer/pages/api/mantys/check-status.ts` - Added status updates
- `/renderer/components/MantysEligibilityForm.tsx` - Fixed Mednet TPA mapping

## Support

For issues or questions:
1. Check Redis connection in Azure portal
2. Review API logs for error messages
3. Verify Redis keys exist using Redis CLI
4. Contact development team

---

**Last Updated**: 2025-12-11
**Version**: 1.0
**Maintainer**: Development Team
