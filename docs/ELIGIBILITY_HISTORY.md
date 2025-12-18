# Eligibility History Feature

## Overview

The Eligibility History feature allows users to run multiple eligibility checks simultaneously and track all past and current checks in a centralized history view. All data is stored in Redis for clinic-wide persistence and scalability.

## Features

### 1. **Parallel Processing**
- Run multiple eligibility checks at the same time
- Each check is tracked independently
- No need to wait for one check to complete before starting another

### 2. **Real-Time Status Updates**
- Live screenshots from TPA portals during extraction
- Document preview as they're being processed
- Progress indicators showing polling attempts
- Auto-refresh every 2 seconds

### 3. **Complete History Tracking**
- All eligibility checks are automatically saved
- Search by patient ID, name, or insurance payer
- Filter by status (All, Active, Completed)
- Delete individual checks or clear all history

### 4. **Persistent Storage**
- Uses Redis for clinic-wide storage
- Survives page refreshes and device changes
- Automatically cleaned up after 30 days
- Maximum 100 items per clinic to prevent storage overflow
- Individual keys per item for efficient queries

## Architecture

### Components

#### `EligibilityHistoryService`
Location: `renderer/utils/eligibilityHistory.ts`

Client-side service for managing history data. Calls API routes that use Redis storage.

#### `EligibilityHistoryRedisService`
Location: `renderer/lib/redis-eligibility-history.ts`

Server-side Redis service for managing eligibility history with proper indexing:
- Individual keys per history item
- Clinic-wide indexing for fast queries
- Task ID indexing for quick lookups
- Patient ID indexing for patient-specific queries

**Key Methods:**
- `add(item)` - Add new check to history
- `getAll()` - Get all history items
- `getById(id)` - Get specific item by ID
- `getByTaskId(taskId)` - Get item by Mantys task ID
- `update(id, updates)` - Update existing item
- `updateByTaskId(taskId, updates)` - Update by task ID
- `delete(id)` - Remove item from history
- `clearAll()` - Clear entire history
- `getActive()` - Get pending/processing checks
- `getCompleted()` - Get completed/error checks
- `search(query)` - Search by patient info
- `cleanup(days)` - Remove old completed items

**Data Structure:**
```typescript
interface EligibilityHistoryItem {
  id: string;                    // Unique ID for this check
  clinicId: string;               // Clinic ID for clinic-wide storage
  patientId: string;             // Patient ID (Emirates ID, etc.)
  taskId: string;                // Mantys task ID
  patientName?: string;          // Patient name
  dateOfBirth?: string;          // Date of birth
  insurancePayer?: string;       // Insurance company
  patientMPI?: string;           // Patient MPI
  appointmentId?: number;        // Appointment ID
  encounterId?: number;          // Encounter ID
  status: 'pending' | 'processing' | 'complete' | 'error';
  createdAt: string;             // ISO timestamp
  completedAt?: string;          // ISO timestamp
  result?: any;                  // Final eligibility result
  interimResults?: {             // Live extraction data
    screenshot?: string;         // Base64 screenshot
    documents?: Array<{          // Extracted documents
      name: string;
      url: string;
      type: string;
    }>;
  };
  error?: string;                // Error message if failed
  pollingAttempts?: number;      // Current polling attempt
}
```

**Redis Key Structure:**
- `eligibility:history:item:{historyId}` → Full history item (JSON)
- `eligibility:history:clinic:{clinicId}` → Set of historyIds for this clinic
- `eligibility:history:task:{taskId}` → historyId (for quick lookup by taskId)
- `eligibility:history:patient:{patientId}` → Set of historyIds for this patient

#### `EligibilityHistoryList`
Location: `renderer/components/EligibilityHistoryList.tsx`

UI component displaying all eligibility checks with search and filter capabilities.

**Features:**
- Search bar for filtering by patient info
- Status filter buttons (All, Active, Completed)
- Real-time auto-refresh every 2 seconds
- Click any item to view details in modal
- Delete individual items
- Clear all history button
- Relative timestamps ("2 mins ago")
- Visual status badges and icons

#### `MantysEligibilityForm` (Enhanced)
Location: `renderer/components/MantysEligibilityForm.tsx`

Updated to integrate with history service.

**Changes:**
- Imports `EligibilityHistoryService`
- Creates history entry when task is submitted
- Updates history during polling with status changes
- Updates interim results (screenshot, documents)
- Marks as complete/error when done
- Tracks polling attempts in history

#### `eligibility-checks` Page
Location: `renderer/pages/eligibility-checks.tsx`

Dedicated page for eligibility checks with history.

**Tabs:**
1. **New Check** - Form to create new eligibility checks
2. **History** - List of all past and current checks

**Features:**
- Quick stats cards
- Pro tips for parallel processing
- Navigation link in header

## Usage

### Running Multiple Checks

1. Navigate to `/eligibility-checks`
2. Fill in patient details and submit
3. Immediately start another check without waiting
4. Switch to "History" tab to monitor all checks
5. Click any check to view detailed progress

### Viewing History

1. Go to "History" tab
2. Use search bar to find specific patients
3. Filter by status (Active/Completed)
4. Click on any item to open progress modal
5. View live screenshots and documents
6. Delete unwanted items

### Storage Management

History is automatically managed:
- Maximum 100 items per clinic stored
- Old items removed after 30 days (TTL)
- Can manually clear all with "Clear All" button (clears clinic history)
- Each item includes all check data
- Clinic-wide visibility (all users in a clinic see the same history)

## Integration Flow

```
User submits eligibility check
        ↓
1. Call backend API to create task
        ↓
2. Add to history with status 'pending'
        ↓
3. Start polling Mantys API
        ↓
4. Update history on each poll:
   - Status changes (pending → processing → complete)
   - Interim results (screenshots, documents)
   - Polling attempt count
        ↓
5. Mark complete/error when done
        ↓
6. User can view in history anytime
```

## API Updates Required

The backend polling should return interim results:

```typescript
// Status check response
{
  status: 'pending' | 'processing' | 'complete' | 'error',
  message?: string,
  interimResults?: {
    screenshot?: string,      // Base64 image
    documents?: Array<{       // Documents found so far
      name: string,
      url: string,
      type: string
    }>
  },
  result?: any                // Final result when complete
}
```

## Future Enhancements

### Additional Features
- Export history to CSV/Excel
- Print eligibility reports
- Email reports to patients
- Batch eligibility checks
- Scheduled checks
- Notifications when check completes
- Advanced search and filtering
- Analytics and reporting
- Audit trail

### Additional Features
- Export history to CSV/Excel
- Print eligibility reports
- Email reports to patients
- Batch eligibility checks
- Scheduled checks
- Notifications when check completes

## Storage Architecture

### Redis Storage
- All history stored in Redis with individual keys per item
- Clinic-wide scope (all users in a clinic share history)
- Efficient queries using Redis sets for indexing
- Automatic TTL expiration (30 days)
- Maximum 100 items per clinic (oldest items auto-removed)

### Performance
- O(1) lookups by historyId, taskId
- Fast clinic-wide queries using Redis sets
- Efficient bulk operations using Redis pipelines
- No need to load all items for queries

## Troubleshooting

### History not appearing
- Check Redis connection is working
- Verify clinicId is correctly passed in API calls
- Check console for errors
- Verify user has access to the clinic

### Too many items
- Oldest items are automatically removed (max 100 per clinic)
- Manually clear all with "Clear All" button
- TTL automatically removes items after 30 days

### Screenshots not loading
- Ensure backend returns base64 images
- Check image size isn't too large
- Verify correct MIME type in base64 string

### Performance issues
- Reduce auto-refresh interval
- Clear old completed items
- Limit number of simultaneous checks

## Code Examples

### Adding custom filters
```typescript
// Get checks from last 24 hours
const recentChecks = EligibilityHistoryService.getAll().filter(item => {
  const itemDate = new Date(item.createdAt);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return itemDate > oneDayAgo;
});
```

### Export history
```typescript
// Export to JSON file
const exportHistory = () => {
  const json = EligibilityHistoryService.export();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eligibility-history-${Date.now()}.json`;
  a.click();
};
```

### Manual cleanup
```typescript
// Remove items older than 7 days
EligibilityHistoryService.cleanup(7);

// Remove all completed items
const completedIds = EligibilityHistoryService.getCompleted()
  .map(item => item.id);
completedIds.forEach(id => EligibilityHistoryService.delete(id));
```

## Security Considerations

- Data stored in Redis (server-side)
- Screenshots may contain PHI/PII
- Clinic-wide access (all users in clinic can see history)
- Implement proper access controls at API level
- Follow HIPAA/PHI guidelines if applicable
- Redis should be secured with authentication
- Consider encryption at rest for sensitive data

## Performance Tips

1. Limit concurrent checks to 5-10 maximum
2. Clear completed checks regularly
3. Use search/filter instead of displaying all items
4. Consider pagination for large histories
5. Compress screenshots before storing
6. Implement lazy loading for images

## Conclusion

The Eligibility History feature provides a powerful way to manage multiple eligibility checks efficiently. With real-time updates, comprehensive history tracking, and parallel processing capabilities, users can handle high volumes of checks while maintaining full visibility into the process.

The Redis-based storage ensures clinic-wide visibility, scalability, and persistence across devices and sessions. The individual key structure with proper indexing provides efficient queries and operations even with large histories.