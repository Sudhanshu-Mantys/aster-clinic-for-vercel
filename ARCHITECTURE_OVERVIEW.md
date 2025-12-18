# Architecture Overview

## Project Structure

This is a **Nextron** application (Next.js + Electron) for managing healthcare clinic operations, specifically focused on insurance eligibility checks and patient management.

```
aster-clinics/
├── main/                    # Electron main process (Node.js)
│   ├── background.ts       # Main Electron process
│   ├── preload.ts          # Preload script for security
│   └── helpers/            # Electron window helpers
│
├── renderer/                # Next.js frontend (React)
│   ├── components/         # React components
│   ├── pages/             # Next.js pages & API routes
│   ├── lib/               # Shared utilities & services
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── services/          # Background services
│   ├── utils/             # Helper functions
│   └── types/             # TypeScript type definitions
│
└── app/                    # Legacy Electron files (deprecated)
```

---

## Data Storage Architecture

### 1. **Redis** (Primary Persistent Storage)

Redis is used for **server-side persistent storage** across all users and devices.

#### **Patient Context** (`redis-patient-context.ts`)
- **Purpose**: Store patient/appointment context for quick lookup
- **Keys**:
  - `patient:mpi:{mpi}` → Patient context by MPI
  - `patient:id:{patientId}` → Patient context by Patient ID
  - `appointment:{appointmentId}` → Patient context by Appointment ID
- **TTL**: 30 days
- **Stored When**:
  - Patient search by MPI
  - Today's appointments loaded
  - Eligibility check performed
- **Used For**: Auto-filling forms, enriching requests

#### **Eligibility Mapping** (`redis-eligibility-mapping.ts`)
- **Purpose**: Track eligibility checks and link them to patients
- **Keys**:
  - `eligibility:task:{taskId}` → Full metadata (JSON)
  - `eligibility:mpi:{mpi}` → Set of taskIds for this MPI
  - `eligibility:patient:{patientId}` → Set of taskIds for this patient
  - `eligibility:emirates:{emiratesId}` → Set of taskIds for this Emirates ID
  - `eligibility:member:{memberId}` → Set of taskIds for this member ID
- **TTL**: 90 days
- **Stored When**: Eligibility check is created
- **Used For**: Finding eligibility history by various identifiers

#### **Clinic Configuration** (`redis-config-store.ts`)
- **Purpose**: Store clinic-specific configuration
- **Keys**: `clinic:config:{clinicId}:{configType}`
- **Stored**: TPA mappings, networks, plans, doctors, etc.
- **Used For**: Dropdown options, form validation

### 2. **localStorage** (Client-Side Cache)

Used for **browser-specific temporary storage**:

#### **Eligibility History** (`utils/eligibilityHistory.ts`)
- **Purpose**: Store eligibility check history in user's browser
- **Key**: `eligibility_history`
- **Stored**: All eligibility checks performed by this user
- **TTL**: Until user clears browser data
- **Used For**: Quick access to recent checks, UI state

#### **Request Cache** (`lib/request-cache.ts`)
- **Purpose**: Cache API responses to reduce network calls
- **Key**: Various keys based on request
- **TTL**: Short-lived (seconds to minutes)
- **Used For**: Performance optimization

### 3. **In-Memory** (Runtime State)

#### **React State** (Components)
- Component-level state (useState)
- Context state (AuthContext, etc.)
- **Cleared**: On page refresh/component unmount

#### **Background Polling Service** (`services/eligibilityPollingService.ts`)
- **Purpose**: Poll eligibility check status in background
- **Storage**: In-memory Map of active tasks
- **Persistence**: Also stored in Redis (`/api/eligibility-history/tasks`)
- **Used For**: Continuing polls even when tab is closed

---

## API Architecture

### **Next.js API Routes** (`renderer/pages/api/`)

All API routes are server-side Next.js API handlers that:
- Connect to Redis
- Call external APIs (Aster, Mantys, Lifetrenz)
- Return JSON responses

#### **Main API Categories**:

1. **Patient APIs** (`/api/patient/`)
   - `search-mpi.ts` - Search patient by MPI
   - `search-phone.ts` - Search patient by phone
   - `details.ts` - Get patient details
   - `context.ts` - Get patient context from Redis
   - `insurance-details.ts` - Get insurance details

2. **Appointment APIs** (`/api/appointments/`)
   - `today.ts` - Get today's appointments
   - Stores patient context in Redis automatically

3. **Mantys APIs** (`/api/mantys/`)
   - `eligibility-check.ts` - Create eligibility check task
   - `check-status.ts` - Check task status (polls Mantys API)
   - Handles both regular and search_all tasks

4. **Eligibility APIs** (`/api/eligibility/`)
   - `get-by-mpi.ts` - Get eligibility checks by MPI
   - `get-by-patient-id.ts` - Get by patient ID
   - `get-by-emirates-id.ts` - Get by Emirates ID
   - `get-by-member-id.ts` - Get by member ID

5. **Eligibility History APIs** (`/api/eligibility-history/`)
   - `index.ts` - CRUD operations for history (uses localStorage)
   - `tasks.ts` - Background polling task management (uses Redis)

6. **Clinic Config APIs** (`/api/clinic-config/`)
   - `clinic.ts` - Clinic settings
   - `doctors/` - Doctor list
   - `tpa/` - TPA configurations
   - `networks/` - Network mappings
   - `payers/` - Payer configurations
   - `plans/` - Insurance plans
   - `plan-mappings/` - Plan mappings

7. **Aster APIs** (`/api/aster/`)
   - `save-eligibility-order.ts` - Save eligibility to Aster
   - `save-policy.ts` - Save policy to Aster
   - `upload-attachment.ts` - Upload documents to Aster

---

## Component Architecture

### **Page Components** (`renderer/pages/`)

- `dashboard.tsx` - Main dashboard with appointments
- `eligibility-checks.tsx` - Eligibility check interface
- `clinic-config.tsx` - Clinic configuration UI
- `login.tsx` / `signup.tsx` - Authentication

### **Feature Components** (`renderer/components/`)

#### **Appointment Management**:
- `TodaysAppointmentsList.tsx` - List of today's appointments
- `AppointmentsTable.tsx` - Table view of appointments
- `AppointmentsFilterForm.tsx` - Filter/search appointments

#### **Eligibility Checking**:
- `MantysEligibilityForm.tsx` - Form to initiate eligibility check
- `ExtractionProgressModal.tsx` - **Stateless modal** that polls status
- `MantysResultsDisplay.tsx` - Display eligibility results
- `EligibilityHistoryList.tsx` - List of past eligibility checks

#### **Patient Management**:
- `PatientSearchForm.tsx` - Search for patients
- `PatientDetailsDisplay.tsx` - Display patient info
- `PatientSelectionList.tsx` - Select from patient list

#### **Insurance**:
- `InsuranceDetailsSection.tsx` - Display insurance details
- `LifetrenzEligibilityPreview.tsx` - Lifetrenz integration
- `LifetrenzDataPreview.tsx` - Lifetrenz data display

#### **UI Components** (`components/ui/`):
- `modal.tsx`, `drawer.tsx`, `button.tsx`, `input.tsx`, etc.
- Reusable shadcn/ui-style components

---

## Data Flow Examples

### **1. Eligibility Check Flow**

```
User clicks "Check Eligibility"
  ↓
MantysEligibilityForm.tsx
  ↓
POST /api/mantys/eligibility-check
  ↓
  ├─→ Creates task in Mantys API
  ├─→ Stores metadata in Redis (eligibility:task:{taskId})
  ├─→ Stores patient context in Redis (if needed)
  └─→ Returns task_id
  ↓
ExtractionProgressModal opens with taskId
  ↓
Modal polls /api/mantys/check-status every 5 seconds
  ↓
  ├─→ API calls Mantys API directly
  ├─→ Returns status, screenshots, documents
  └─→ Updates Redis status
  ↓
When complete:
  ├─→ Modal calls onComplete callback
  ├─→ MantysResultsDisplay shows results
  └─→ Results saved to localStorage history
```

### **2. Patient Context Flow**

```
User searches patient by MPI
  ↓
POST /api/patient/search-mpi
  ↓
  ├─→ Calls Aster API
  ├─→ Gets patient data
  └─→ Stores in Redis:
      - patient:mpi:{mpi}
      - patient:id:{patientId}
      - appointment:{appointmentId} (if available)
  ↓
Later, when checking eligibility:
  ├─→ Form can fetch context from Redis
  └─→ Auto-fills patient info
```

### **3. Background Polling Flow**

```
Eligibility check created
  ↓
eligibilityPollingService.addTask(taskId, historyId)
  ↓
Service stores task in:
  ├─→ In-memory Map (for active polling)
  └─→ Redis (/api/eligibility-history/tasks)
  ↓
Background service polls every 2 seconds
  ↓
  ├─→ Calls /api/mantys/check-status
  ├─→ Updates localStorage history
  └─→ Continues even if tab is closed
  ↓
When complete:
  └─→ Removes from active tasks
```

---

## Key Services

### **1. EligibilityPollingService** (`services/eligibilityPollingService.ts`)
- **Purpose**: Background polling that continues even when UI is closed
- **Storage**: In-memory + Redis
- **Poll Interval**: 2 seconds
- **Max Attempts**: 150 (5 minutes)

### **2. EligibilityHistoryService** (`utils/eligibilityHistory.ts`)
- **Purpose**: Manage eligibility history in localStorage
- **Storage**: Browser localStorage
- **Operations**: Add, update, get, delete history items

### **3. Redis Services** (`lib/redis-*.ts`)
- `redis-client.ts` - Base Redis connection
- `redis-patient-context.ts` - Patient context storage
- `redis-eligibility-mapping.ts` - Eligibility mapping
- `redis-config-store.ts` - Clinic configuration

---

## External Integrations

### **1. Mantys API** (Insurance Eligibility)
- **Base URL**: `https://aster.api.mantys.org`
- **Endpoints**:
  - `/v2/api-integration-v2/create-task` - Create eligibility check
  - `/v2/api-integration-v2/eligibility-result/{task_id}` - Get status/results
- **Features**: Regular checks, search_all (multiple TPAs)

### **2. Aster API** (Hospital System)
- **Purpose**: Patient data, appointments, insurance details
- **Endpoints**: Various (see `lib/api.ts`)

### **3. Lifetrenz API**
- **Purpose**: Alternative eligibility checking
- **Files**: `lib/liftrenz-auth-token.ts`, `components/Lifetrenz*.tsx`

### **4. Stack Auth** (Authentication)
- **Purpose**: User authentication
- **Context**: `contexts/AuthContext.tsx`

---

## Environment Variables

Key environment variables (stored in `.env` or `.env.local`):

```bash
# Redis
REDIS_URL=redis://...

# Mantys
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_...
MANTYS_CLIENT_ID=aster-clinic
MANTYS_CLINIC_ID=92d5da39-36af-4fa2-bde3-3828600d7871

# Stack Auth
NEXT_PUBLIC_STACK_API_URL=https://api.stack-auth.com/api/v1
NEXT_PUBLIC_STACK_PROJECT_ID=...
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=...

# Aster API
ASTER_API_URL=...
ASTER_API_KEY=...
```

---

## State Management Summary

| Data Type | Storage | Scope | TTL | Purpose |
|-----------|---------|-------|-----|---------|
| Patient Context | Redis | Clinic-wide | 30 days | Quick patient lookup |
| Eligibility Metadata | Redis | Clinic-wide | 90 days | Track eligibility checks |
| Eligibility History | localStorage | User-specific | Until cleared | Recent checks UI |
| Clinic Config | Redis | Clinic-wide | Persistent | Dropdowns, validation |
| Active Polling Tasks | Redis + Memory | App-wide | Until complete | Background polling |
| Request Cache | Memory | Request | Seconds | Performance |
| Auth State | Context | Session | Until logout | User session |

---

## Key Design Patterns

1. **Stateless Components**: `ExtractionProgressModal` fetches fresh data on open
2. **Background Services**: Polling continues independently of UI
3. **Dual Storage**: Redis for persistence, localStorage for UI state
4. **API Proxy**: All external APIs called through Next.js API routes
5. **Context Pattern**: Auth state managed via React Context
6. **Service Layer**: Business logic in services, not components

---

## File Organization Principles

- **Components**: UI/presentation logic only
- **Services**: Business logic, background tasks
- **Lib**: Utilities, helpers, external integrations
- **Utils**: Data transformation, formatting
- **Types**: TypeScript definitions
- **Pages/API**: Server-side logic, external API calls
- **Contexts**: Global React state

---

This architecture ensures:
- ✅ **Scalability**: Redis handles clinic-wide data
- ✅ **Performance**: Caching at multiple levels
- ✅ **Reliability**: Background polling continues independently
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **User Experience**: Fast UI with background processing

