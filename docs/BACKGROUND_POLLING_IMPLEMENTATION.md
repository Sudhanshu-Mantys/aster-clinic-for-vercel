# Background Polling Implementation Guide

## Overview

The eligibility check system now uses **background polling** that runs independently of the UI. This means:

✅ **Polling continues even when tabs are closed**  
✅ **Users can start multiple checks simultaneously**  
✅ **Results are automatically saved to localStorage**  
✅ **Status updates persist across page refreshes**  
✅ **No dependency on keeping the UI open**

---

## Architecture

### 1. Background Polling Service
**File:** `renderer/services/eligibilityPollingService.ts`

A singleton service that manages all active eligibility checks independently from React components.

**Key Features:**
- Runs at the application level (initialized in `_app.tsx`)
- Polls all active tasks every 2 seconds
- Persists active tasks to localStorage
- Automatically resumes polling on app restart
- Updates history in real-time
- Removes completed/failed tasks from queue

**Core Methods:**
```typescript
// Initialize service (called once at app startup)
pollingService.initialize()

// Add a new task to poll
pollingService.addTask(taskId, historyId)

// Remove task from polling
pollingService.removeTask(taskId)

// Get count of active tasks
pollingService.getActiveCount()

// Check if specific task is active
pollingService.isTaskActive(taskId)
```

### 2. History Storage
**File:** `renderer/utils/eligibilityHistory.ts`

LocalStorage-based persistence layer for all eligibility checks.

**Features:**
- Stores up to 100 items
- Auto-cleanup after 30 days
- Search and filter capabilities
- Tracks interim results (screenshots, documents)
- Updates status in real-time

### 3. Component Integration

#### MantysEligibilityForm
- Creates history entry when task is submitted
- Adds task to background polling service
- Monitors history for UI updates (optional)
- Can be closed - polling continues

#### EligibilityHistoryList
- Displays all checks with auto-refresh
- Filters by status (All, Active, Completed)
- Search by patient info
- Click to view details

---

## How It Works

### Flow Diagram

```
1. User submits eligibility check
         ↓
2. Backend creates task → returns task_id
         ↓
3. Create entry in localStorage (status: 'pending')
         ↓
4. Add to background polling service
         ↓
5. Service polls every 2 seconds
         ↓
6. Updates localStorage with:
   - Status changes
   - Interim screenshots
   - Documents
   - Polling attempts
         ↓
7. When complete/error:
   - Update final status
   - Remove from polling queue
         ↓
8. User can view in history anytime
```

### Lifecycle

```typescript
// App Initialization (_app.tsx)
useEffect(() => {
  pollingService.initialize()
  // Automatically resumes any active polls from localStorage
  
  return () => pollingService.shutdown()
}, [])

// Submit Check (MantysEligibilityForm)
const handleSubmit = async () => {
  // 1. Create task via API
  const { task_id } = await createTask(...)
  
  // 2. Add to history
  const historyItem = EligibilityHistoryService.add({
    taskId: task_id,
    patientId: emiratesId,
    status: 'pending',
    ...
  })
  
  // 3. Start background polling
  pollingService.addTask(task_id, historyItem.id)
  
  // 4. Optional: Monitor for UI updates
  monitorTaskStatus(task_id, historyItem.id)
  
  // ✅ User can now close tab - polling continues!
}

// Background Polling Loop (automatic)
setInterval(() => {
  activeTasks.forEach(async (task) => {
    const status = await checkStatus(task.taskId)
    
    // Update localStorage
    EligibilityHistoryService.updateByTaskId(task.taskId, {
      status: status.status,
      pollingAttempts: task.attempts,
      interimResults: status.interimResults,
    })
    
    // Remove if complete
    if (status.status === 'complete' || status.status === 'error') {
      pollingService.removeTask(task.taskId)
    }
  })
}, 2000)
```

---

## Benefits

### 1. **User Can Close Tabs**
- Start check, close browser
- Open later, results are there
- No need to keep page open

### 2. **Multiple Parallel Checks**
- Submit multiple checks at once
- All tracked independently
- View progress of all in history

### 3. **Persistent Across Refreshes**
- Page refresh doesn't stop polling
- History preserved in localStorage
- Resumes automatically on load

### 4. **Efficient Resource Usage**
- Single polling loop for all tasks
- Automatic cleanup when complete
- No memory leaks from intervals

### 5. **Better UX**
- Real-time status updates
- Visual feedback in history
- Can monitor multiple checks at once

---

## Usage Examples

### Start Multiple Checks

```typescript
// User can do this rapidly
submitCheck(patient1) // Task A starts polling
submitCheck(patient2) // Task B starts polling
submitCheck(patient3) // Task C starts polling

// All three poll independently in background
// User can close modal/tab
// Check history to see results later
```

### Resume After Page Refresh

```typescript
// Before refresh: 3 active checks polling

// User refreshes page

// On app mount:
pollingService.initialize()
  → Loads active tasks from localStorage
  → Resumes polling for all 3 tasks
  → No interruption in service
```

### Close Tab Scenario

```typescript
// 10:00 AM - User starts eligibility check
submitCheck(patient) 
// Status: pending

// 10:01 AM - User closes browser tab
// ❌ Old implementation: Polling stops, check incomplete
// ✅ New implementation: Polling continues in background

// 10:05 AM - User opens app again
// Result is already complete in history!
```

---

## Configuration

### Polling Settings

```typescript
// In eligibilityPollingService.ts
const MAX_ATTEMPTS = 150        // 150 attempts * 2s = 5 minutes
const POLL_INTERVAL = 2000      // 2 seconds between polls
```

### History Settings

```typescript
// In eligibilityHistory.ts
const MAX_HISTORY_ITEMS = 100   // Maximum items stored
const DAYS_TO_KEEP = 30         // Auto-cleanup after 30 days
```

---

## Storage Structure

### Active Tasks (localStorage)

```json
{
  "eligibility_polling_tasks": [
    {
      "taskId": "task_abc123",
      "historyId": "1234567890-xyz",
      "attempts": 45,
      "startedAt": 1234567890000
    }
  ]
}
```

### History (localStorage)

```json
{
  "mantys_eligibility_history": [
    {
      "id": "1234567890-xyz",
      "taskId": "task_abc123",
      "patientId": "784-1234-5678901-2",
      "patientName": "John Doe",
      "insurancePayer": "BOTH",
      "status": "processing",
      "pollingAttempts": 45,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "interimResults": {
        "screenshot": "data:image/png;base64,...",
        "documents": [
          {
            "name": "eligibility_response.pdf",
            "url": "https://...",
            "type": "eligibility"
          }
        ]
      }
    }
  ]
}
```

---

## Monitoring & Debugging

### Console Logs

The service logs all major events:

```
[PollingService] Initializing background polling service
[PollingService] Loaded 2 active task(s) from storage
[PollingService] Resuming polling for 2 active check(s)
[PollingService] Adding task task_abc123 to polling queue
[PollingService] Polling 3 active task(s)
[PollingService] Task task_abc123 completed successfully
[PollingService] Removing task task_abc123 from polling queue
```

### Check Active Tasks

```typescript
// In browser console
import pollingService from './services/eligibilityPollingService'

// How many tasks are polling?
pollingService.getActiveCount()

// Is specific task active?
pollingService.isTaskActive('task_abc123')
```

### Check History

```typescript
import { EligibilityHistoryService } from './utils/eligibilityHistory'

// Get all active checks
EligibilityHistoryService.getActive()

// Get all history
EligibilityHistoryService.getAll()

// Get specific task
EligibilityHistoryService.getByTaskId('task_abc123')
```

---

## Error Handling

### Timeout (5 minutes)
- After 150 attempts, task is marked as error
- Automatically removed from polling queue
- Error message saved to history

### Network Errors
- Retries automatically (service keeps polling)
- Only marks as error after 3 consecutive failures
- User can retry from history

### localStorage Full
- Automatically reduces history to 50% capacity
- Removes oldest completed items first
- Keeps all active checks

---

## Performance Considerations

### Memory Usage
- Single interval for all tasks (not one per task)
- Tasks stored in Map (O(1) lookups)
- Auto-cleanup prevents unlimited growth

### Network Usage
- One API call per task per 2 seconds
- 10 concurrent tasks = 5 requests/second
- Consider rate limiting for production

### Storage Usage
- ~5-50KB per check (with screenshots)
- 100 items ≈ 500KB - 5MB
- Well within localStorage limits (5-10MB)

---

## Future Enhancements

### Recommended for Production

1. **Backend Storage**
   - Move from localStorage to database
   - Share history across devices/team
   - Better security for PHI

2. **Notifications**
   - Browser notifications when complete
   - Email alerts for long-running checks
   - Slack/Teams integration

3. **Rate Limiting**
   - Limit concurrent checks per user
   - Queue excess checks
   - Prevent API overload

4. **Analytics**
   - Track success rates
   - Monitor average completion time
   - Identify problematic TPAs

5. **Service Worker**
   - Run polling in service worker
   - Works even when all tabs closed
   - True background processing

---

## Migration from Old Implementation

### Before (Component-based polling)
```typescript
// ❌ Polling tied to component lifecycle
const pollForStatus = async (taskId) => {
  const interval = setInterval(() => {
    checkStatus(taskId)
  }, 2000)
  
  // Stops when component unmounts!
}
```

### After (Service-based polling)
```typescript
// ✅ Polling independent of components
pollingService.addTask(taskId, historyId)

// Continues even when:
// - Modal is closed
// - Tab is closed
// - Page is refreshed
```

---

## Testing

### Manual Testing Checklist

- [ ] Start check, close modal - check continues
- [ ] Start check, refresh page - polling resumes
- [ ] Start 5 checks simultaneously - all complete
- [ ] Close browser, reopen - active checks resume
- [ ] Check completes after 5 minutes - timeout works
- [ ] Network error - retries automatically
- [ ] View details from history - shows correct data
- [ ] Delete from history - removes item
- [ ] Clear all history - removes all items

### Edge Cases

- [ ] Start check, wait 4 minutes, refresh - continues
- [ ] 10 concurrent checks - all complete successfully
- [ ] localStorage full - handles gracefully
- [ ] API returns error immediately - marks as error
- [ ] Task takes > 5 minutes - times out correctly

---

## Troubleshooting

### Polling Not Working
1. Check console for "[PollingService]" logs
2. Verify `pollingService.initialize()` was called
3. Check localStorage for "eligibility_polling_tasks"

### History Not Updating
1. Check localStorage quota (may be full)
2. Verify EligibilityHistoryService methods working
3. Check browser localStorage is enabled

### Performance Issues
1. Reduce POLL_INTERVAL (increase from 2s)
2. Limit concurrent checks
3. Clear old history items

---

## Summary

The background polling implementation provides a robust, user-friendly system for handling eligibility checks that:

- **Works independently of UI** - no need to keep page open
- **Persists across sessions** - survives page refreshes
- **Handles multiple checks** - parallel processing
- **Provides real-time updates** - live screenshots and status
- **Stores complete history** - searchable and filterable

This is a significant UX improvement over the previous implementation where users had to keep the modal open until completion.

For production deployment, strongly recommend moving from localStorage to a backend database for better security, scalability, and cross-device support.