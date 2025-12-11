# Redis Patient Context System

This document describes the Redis-based system for automatically storing and retrieving patient and appointment context information.

## Overview

The patient context system automatically stores patient and appointment information in Redis whenever:
1. A patient is searched by MPI
2. Today's appointments are loaded
3. An eligibility check is performed

This ensures that appointment ID, encounter ID, and other patient information is always available when needed.

## Architecture

### Data Structure

Each patient/appointment context is stored with the following information:

```typescript
interface PatientContext {
  mpi: string;                 // Master Patient Index
  patientId: number;           // Internal patient ID
  patientName: string;         // Full patient name
  appointmentId?: number;      // Appointment ID (if from appointment)
  encounterId?: number;        // Encounter ID (if available)
  phone?: string;              // Patient phone number
  email?: string;              // Patient email
  dob?: string;                // Date of birth
  gender?: string;             // Patient gender
  lastUpdated: string;         // ISO timestamp of last update
}
```

### Redis Key Patterns

The system uses multiple keys to enable lookups from different identifiers:

| Key Pattern | Purpose | Data Type | TTL |
|------------|---------|-----------|-----|
| `patient:mpi:{mpi}` | Stores context by MPI | String (JSON) | 30 days |
| `patient:id:{patientId}` | Stores context by patient ID | String (JSON) | 30 days |
| `appointment:{appointmentId}` | Stores context by appointment ID | String (JSON) | 30 days |

### Example Redis Structure

```
# Patient context by MPI
patient:mpi:1005974820
→ {"mpi":"1005974820","patientId":5974820,"patientName":"Mohamed Hasan Bashir","appointmentId":28099881,...}

# Patient context by patient ID
patient:id:5974820
→ {"mpi":"1005974820","patientId":5974820,"patientName":"Mohamed Hasan Bashir","appointmentId":28099881,...}

# Patient context by appointment ID
appointment:28099881
→ {"mpi":"1005974820","patientId":5974820,"patientName":"Mohamed Hasan Bashir","appointmentId":28099881,...}
```

## Automatic Storage Points

### 1. MPI Search API (`/api/patient/search-mpi`)

**When**: User searches for a patient by MPI

**What gets stored**:
- MPI from search query
- Patient ID from API response
- Patient name from API response
- Appointment ID (if in search results)
- Encounter ID (if available)
- Phone, email, DOB, gender

**Example Flow**:
```
User searches MPI: 1005974820
  ↓
API returns appointment data
  ↓
Stores context in Redis with keys:
  - patient:mpi:1005974820
  - patient:id:5974820
  - appointment:28099881
```

### 2. Today's Appointments API (`/api/appointments/today`)

**When**: Dashboard loads today's appointments

**What gets stored**:
- MPI for each appointment
- Patient ID for each appointment
- Patient name
- Appointment ID
- Encounter ID (if available)
- Phone, email, DOB, gender

**Example Flow**:
```
Dashboard loads
  ↓
Fetches today's 198 appointments
  ↓
Stores context for each appointment in Redis
  ↓
Log: "📝 Stored context for appointment: 28099881, MPI: 1005974820"
```

### 3. Eligibility Check API (`/api/mantys/eligibility-check`)

**When**: User performs eligibility check

**What happens**:
1. **Enrichment**: If MPI or patient ID is provided, retrieves stored context from Redis
2. **Auto-fill**: Fills in missing information (patient name, IDs) from Redis
3. **Storage**: Stores eligibility check metadata with enriched information

**Example Flow**:
```
User clicks "Check Eligibility" for appointment 28099881
  ↓
Form passes MPI: 1005974820
  ↓
API retrieves context from Redis
  ↓
Enriches request with appointmentId: 28099881, patientId: 5974820
  ↓
Stores in eligibility Redis mapping
  ↓
Log: "📥 Retrieved patient context from Redis for MPI: 1005974820"
```

## Benefits

### 1. **Complete Context Preservation**
- Appointment IDs are automatically captured when viewing appointments
- No manual entry required
- Context preserved across sessions

### 2. **Cross-Reference Capability**
- Can look up patient by MPI, patient ID, or appointment ID
- All paths lead to the same complete context

### 3. **Automatic Enrichment**
- Eligibility checks automatically get appointment IDs
- No need to pass all parameters explicitly
- System "remembers" patient context

### 4. **Fast Lookups**
- O(1) retrieval by any identifier
- No database queries required
- <10ms response time

### 5. **Resilient Design**
- All Redis operations are non-blocking
- Failures don't prevent core functionality
- Graceful degradation

## Usage Examples

### Example 1: Search Patient and Check Eligibility

```typescript
// Step 1: User searches for patient
// API: POST /api/patient/search-mpi
{
  "mpi": "1005974820"
}

// Redis automatically stores:
{
  "mpi": "1005974820",
  "patientId": 5974820,
  "patientName": "Mohamed Hasan Bashir",
  "appointmentId": 28099881,
  "encounterId": 27342125,
  "phone": "568384706",
  "lastUpdated": "2025-12-11T10:30:00Z"
}

// Step 2: User clicks "Check Eligibility"
// Form passes only: { mpi: "1005974820", id_value: "...", tpa_name: "..." }

// Step 3: Eligibility API automatically enriches:
// Retrieved from Redis:
// - patientId: 5974820
// - patientName: "Mohamed Hasan Bashir"
// - appointmentId: 28099881
// - encounterId: 27342125

// Step 4: Results display shows complete information
// - MPI: 1005974820
// - Patient ID: 5974820
// - Appointment ID: 28099881 ✓ (from Redis!)
// - Encounter ID: 27342125 ✓ (from Redis!)
```

### Example 2: View Appointment and Check Eligibility

```typescript
// Step 1: Dashboard loads appointments
// API: GET /api/appointments/today

// Response includes 198 appointments, each automatically stored:
{
  "mpi": "1005713837",
  "patientId": 5713837,
  "patientName": "Priyanka Maheswaran",
  "appointmentId": 28058329,
  "phone": "585670669",
  "lastUpdated": "2025-12-11T08:00:00Z"
}

// Step 2: User clicks on appointment card
// TodaysAppointmentsList converts appointment to PatientData
// Includes: appointmentId: 28058329

// Step 3: User expands insurance and clicks "Check Eligibility"
// Form automatically has all context from appointment

// Step 4: Results display shows:
// - MPI: 1005713837
// - Patient ID: 5713837
// - Appointment ID: 28058329 ✓ (from appointment data!)
// - Policy Holder: Priyanka Maheswaran
```

### Example 3: Manual Retrieval

```typescript
import { patientContextRedisService } from './lib/redis-patient-context';

// Get patient context by MPI
const context = await patientContextRedisService.getPatientContextByMPI('1005974820');

if (context) {
  console.log('Patient:', context.patientName);
  console.log('Appointment ID:', context.appointmentId);
  console.log('Encounter ID:', context.encounterId);
}

// Get patient context by appointment ID
const appointmentContext = await patientContextRedisService.getPatientContextByAppointmentId(28099881);
```

## Integration with Eligibility System

The patient context system works seamlessly with the eligibility Redis mapping system:

```
┌─────────────────────────────────────────────────────────┐
│                   USER ACTIONS                          │
├─────────────────────────────────────────────────────────┤
│ 1. Search MPI → Store in patient:mpi:{mpi}            │
│ 2. Load appointments → Store in appointment:{id}       │
│ 3. Check eligibility → Enrich + Store eligibility     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               REDIS STORAGE LAYER                       │
├─────────────────────────────────────────────────────────┤
│ Patient Context:                                        │
│   patient:mpi:{mpi} → Full patient context             │
│   patient:id:{id} → Full patient context               │
│   appointment:{id} → Full patient context              │
│                                                         │
│ Eligibility Mapping:                                    │
│   eligibility:mpi:{mpi} → Set of taskIds               │
│   eligibility:task:{taskId} → Eligibility metadata     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  RESULT DISPLAY                         │
├─────────────────────────────────────────────────────────┤
│ Shows complete patient information:                     │
│ ✓ MPI (from patient context)                           │
│ ✓ Patient ID (from patient context)                    │
│ ✓ Appointment ID (from patient context)                │
│ ✓ Encounter ID (from patient context)                  │
│ ✓ Policy Holder (from eligibility result)              │
│ ✓ Coverage Details (from eligibility result)           │
└─────────────────────────────────────────────────────────┘
```

## Data Retention

- **TTL**: 30 days for all keys
- **Auto-cleanup**: Redis automatically removes expired keys
- **Manual deletion**: Use `deletePatientContext(mpi)` to remove specific context
- **Updates**: Newer data overwrites older data automatically

## Error Handling

All Redis operations are wrapped in try-catch blocks and marked as non-fatal:

```typescript
try {
  await patientContextRedisService.storePatientContext(context);
  console.log('📝 Stored patient context');
} catch (redisError) {
  console.error('⚠️ Failed to store in Redis (non-fatal):', redisError);
  // Continue - don't block the main operation
}
```

This ensures that Redis failures don't prevent:
- MPI searches from returning results
- Appointments from loading
- Eligibility checks from being performed

## Connection Management

The Redis client uses a singleton pattern with automatic reconnection:

- **Connection pooling**: Single client shared across requests
- **TLS enabled**: Secure connection to Azure Redis
- **Retry strategy**: Exponential backoff (50ms × attempts, max 2000ms)
- **Max retries**: 3 attempts per request

## API Methods

### Store Patient Context

```typescript
await patientContextRedisService.storePatientContext({
  mpi: '1005974820',
  patientId: 5974820,
  patientName: 'Mohamed Hasan Bashir',
  appointmentId: 28099881,
  encounterId: 27342125,
  phone: '568384706',
  email: 'patient@example.com',
  dob: '21/07/1988',
  gender: 'Male',
  lastUpdated: new Date().toISOString()
});
```

### Retrieve by MPI

```typescript
const context = await patientContextRedisService.getPatientContextByMPI('1005974820');
```

### Retrieve by Patient ID

```typescript
const context = await patientContextRedisService.getPatientContextByPatientId(5974820);
```

### Retrieve by Appointment ID

```typescript
const context = await patientContextRedisService.getPatientContextByAppointmentId(28099881);
```

### Update Context

```typescript
await patientContextRedisService.updatePatientContext('1005974820', {
  appointmentId: 28099999,  // New appointment
  lastUpdated: new Date().toISOString()
});
```

### Delete Context

```typescript
await patientContextRedisService.deletePatientContext('1005974820');
```

## Monitoring & Debugging

### Check Redis Keys

```bash
# Connect to Redis CLI
redis-cli --tls -h prod0copay.redis.cache.windows.net -p 6380

# List all patient context keys
KEYS patient:*
KEYS appointment:*

# Get context for specific patient
GET patient:mpi:1005974820

# Get context for specific appointment
GET appointment:28099881
```

### Logs

The system logs key operations:

```
📝 Stored patient context for MPI: 1005974820, Appointment: 28099881
📝 Stored context for appointment: 28099881, MPI: 1005974820
📥 Retrieved patient context from Redis for MPI: 1005974820
⚠️ Failed to store patient context in Redis (non-fatal): [error details]
```

## Security Considerations

1. **No sensitive medical data**: Only basic identifiers and contact info stored
2. **TLS encryption**: All Redis connections use TLS
3. **Access control**: Redis requires authentication
4. **TTL enforcement**: Automatic expiration after 30 days
5. **No PII beyond basics**: No diagnosis, treatment, or financial information

## Files Created/Modified

### New Files
- `/renderer/lib/redis-patient-context.ts` - Patient context Redis service

### Modified Files
- `/renderer/lib/api.ts` - Added appointment_id and encounter_id to PatientData interface
- `/renderer/pages/api/patient/search-mpi.ts` - Added Redis storage for MPI searches
- `/renderer/pages/api/appointments/today.ts` - Added Redis storage for appointments
- `/renderer/pages/api/mantys/eligibility-check.ts` - Added Redis enrichment logic
- `/renderer/components/TodaysAppointmentsList.tsx` - Updated to include appointment_id and encounter_id

## Troubleshooting

### Issue: Appointment ID not showing in results

**Possible Causes**:
1. Patient was not loaded through appointments list
2. Redis storage failed (check logs)
3. MPI doesn't match between sources

**Solution**:
1. Load today's appointments first (this stores context)
2. Then search/view patient
3. Check Redis logs for storage errors

### Issue: Redis connection errors

**Symptoms**: `⚠️ Failed to store in Redis` logs

**Impact**: None - system continues to work

**Solution**:
1. Check Azure Redis status
2. Verify connection string in environment
3. Check network connectivity

---

**Last Updated**: 2025-12-11
**Version**: 1.0
**Maintainer**: Development Team
