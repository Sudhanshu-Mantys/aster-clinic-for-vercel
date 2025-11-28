# Auto-Refresh Drawer Closing Fix

## Problem

When viewing completed eligibility check results from the History page:
- Drawer would open with results displayed
- After 1-2 seconds, drawer would automatically close
- No user interaction required - happened automatically
- Made it impossible to review results

## Root Cause

The `EligibilityHistoryList` component had an auto-refresh mechanism that was causing unwanted behavior:

```typescript
useEffect(() => {
  loadHistory();

  // This was running even when drawer was open!
  const interval = setInterval(() => {
    loadHistory();
    onRefresh?.();
  }, 2000);

  return () => clearInterval(interval);
}, [searchQuery, filterStatus]);
```

### Why This Caused the Problem

1. **Auto-refresh every 2 seconds** - Kept history data fresh
2. **Re-renders component** - `loadHistory()` → `setHistoryItems()` → component re-renders
3. **State reference changes** - `selectedItem` object reference changed on each refresh
4. **React detects change** - Thought selectedItem was new/different
5. **Drawer closes** - State confusion caused drawer to unmount/close

### The Cascade Effect

```
User clicks item
     ↓
setSelectedItem(item) - Object reference #1
     ↓
setShowDrawer(true)
     ↓
Drawer opens and displays results
     ↓
[2 seconds pass]
     ↓
Auto-refresh fires: loadHistory()
     ↓
setHistoryItems(newItems) - New array with new object references
     ↓
Component re-renders
     ↓
selectedItem now references Object #2 (different ref, same data)
     ↓
React diffing algorithm detects change
     ↓
Drawer closes or behaves unexpectedly ❌
```

## Solution

### 1. Use ID-Based Selection Instead of Object Reference

**Before:**
```typescript
const [selectedItem, setSelectedItem] = useState<EligibilityHistoryItem | null>(null);

const handleViewDetails = (item: EligibilityHistoryItem) => {
  setSelectedItem(item); // Storing full object
  setShowDrawer(true);
}
```

**After:**
```typescript
const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

// Derive selectedItem from history by ID
const selectedItem = selectedItemId
  ? EligibilityHistoryService.getById(selectedItemId)
  : null;

const handleViewDetails = (item: EligibilityHistoryItem) => {
  setSelectedItemId(item.id); // Storing just ID
  setShowDrawer(true);
}
```

**Why This Helps:**
- ID is a primitive string (stable reference)
- Doesn't change when history array re-renders
- Can always fetch latest item data by ID
- More React-friendly pattern

### 2. Pause Auto-Refresh When Drawer/Modal is Open

**Before:**
```typescript
useEffect(() => {
  loadHistory();
  
  // Always refreshing, even when viewing results
  const interval = setInterval(() => {
    loadHistory();
    onRefresh?.();
  }, 2000);

  return () => clearInterval(interval);
}, [searchQuery, filterStatus]);
```

**After:**
```typescript
// Effect for initial load
useEffect(() => {
  loadHistory();
}, [searchQuery, filterStatus]);

// Separate effect for auto-refresh that pauses when open
useEffect(() => {
  // Only refresh if drawer/modal is NOT open
  if (!showDrawer && !showModal) {
    const interval = setInterval(() => {
      loadHistory();
      onRefresh?.();
    }, 2000);

    return () => clearInterval(interval);
  }
  // No cleanup needed when drawer is open - interval never created
}, [showDrawer, showModal]);
```

**Why This Helps:**
- Stops unnecessary re-renders during viewing
- Prevents state confusion
- Resumes auto-refresh automatically when drawer closes
- Better user experience (no flicker during viewing)

### 3. Add Safeguard for Missing Items

```typescript
// Close drawer/modal if selected item no longer exists
useEffect(() => {
  if (selectedItemId && !selectedItem) {
    console.warn("Selected item not found in history, closing drawer/modal");
    setShowDrawer(false);
    setShowModal(false);
    setSelectedItemId(null);
  }
}, [selectedItemId, selectedItem]);
```

**Why This Helps:**
- Handles edge case where item is deleted while viewing
- Gracefully closes drawer if data is gone
- Prevents showing stale data
- Adds logging for debugging

## Technical Implementation

### State Management Flow

```typescript
// 1. Store only the ID (primitive)
const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

// 2. Derive the full item when needed
const selectedItem = selectedItemId
  ? EligibilityHistoryService.getById(selectedItemId)
  : null;

// 3. ID remains stable across re-renders
// 4. Always get fresh data from history service
```

### Auto-Refresh Control Flow

```
┌─────────────────────────────────────┐
│   Component Mounts                  │
│   loadHistory() - Initial load      │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│   Check: showDrawer || showModal?   │
└────────────┬────────────────────────┘
             ↓
      ┌──────┴──────┐
      │             │
     YES           NO
      │             │
      ↓             ↓
┌─────────┐   ┌──────────────────┐
│ No      │   │ Start interval   │
│ refresh │   │ Refresh every 2s │
└─────────┘   └──────────────────┘
```

### Event Flow

```
User clicks history item
         ↓
handleViewDetails(item)
         ↓
setSelectedItemId(item.id)  ← Store ID only
         ↓
setShowDrawer(true)  ← Open drawer
         ↓
Auto-refresh effect sees showDrawer=true
         ↓
Auto-refresh PAUSED ✅
         ↓
User reviews results (no interruptions)
         ↓
User clicks close
         ↓
handleCloseDrawer()
         ↓
setShowDrawer(false)
setSelectedItemId(null)
         ↓
Auto-refresh effect sees showDrawer=false
         ↓
Auto-refresh RESUMES ✅
```

## Benefits

✅ **Drawer Stays Open** - No automatic closing  
✅ **Stable Selection** - ID-based selection prevents reference issues  
✅ **Better Performance** - No unnecessary refreshes during viewing  
✅ **Auto-Resume** - Refresh automatically resumes when closed  
✅ **Fresh Data** - Always fetches latest item data by ID  
✅ **Graceful Errors** - Handles missing items properly  

## Testing Checklist

- [x] Open completed check → Drawer stays open
- [x] Keep drawer open for > 5 seconds → Doesn't close
- [x] Close drawer → Auto-refresh resumes
- [x] Open processing check → Modal stays open
- [x] Switch filters while drawer open → Drawer stays open
- [x] Search while drawer open → Drawer stays open
- [x] Delete item while viewing → Drawer closes gracefully
- [x] Multiple rapid opens/closes → No race conditions

## Potential Issues Prevented

### Race Conditions
- Auto-refresh during drawer open
- State updates during transition
- Multiple intervals running

### Memory Leaks
- Intervals not cleaned up
- Event listeners hanging
- Stale closures

### User Experience
- Flickering content
- Interrupted viewing
- Lost context
- Confusion

## Code Comparison

### Before (Problematic)
```typescript
// Object reference stored directly
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

// Always refreshing
useEffect(() => {
  const interval = setInterval(loadHistory, 2000);
  return () => clearInterval(interval);
}, []);

// Object reference changes on every refresh
handleViewDetails(item) {
  setSelectedItem(item); // ❌ Object ref will change
}
```

### After (Fixed)
```typescript
// ID stored (primitive, stable)
const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

// Derived from history
const selectedItem = selectedItemId
  ? getById(selectedItemId)
  : null;

// Conditional refreshing
useEffect(() => {
  if (!showDrawer && !showModal) {
    const interval = setInterval(loadHistory, 2000);
    return () => clearInterval(interval);
  }
}, [showDrawer, showModal]);

// ID stored (stable reference)
handleViewDetails(item) {
  setSelectedItemId(item.id); // ✅ ID stays same
}
```

## Related Patterns

### Derived State Pattern
```typescript
// Don't store derived data in state
// ❌ const [selectedItem, setSelectedItem] = useState(item)

// Do derive from source of truth
// ✅ const selectedItem = getById(selectedItemId)
```

### Conditional Effects Pattern
```typescript
// Pause side effects based on state
useEffect(() => {
  if (shouldRunEffect) {
    const interval = setInterval(action, delay);
    return () => clearInterval(interval);
  }
}, [shouldRunEffect]);
```

### ID-Based Selection Pattern
```typescript
// Store IDs, derive objects
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const selectedItems = selectedIds.map(id => getById(id));
```

## Future Improvements

1. **Debounced Refresh**
   - Only refresh when truly needed
   - Skip refresh if no active checks

2. **Smart Refresh**
   - Only refresh active checks
   - Skip refresh for completed checks

3. **Optimistic Updates**
   - Update UI immediately
   - Sync with server in background

4. **State Management**
   - Use Zustand or Redux
   - Centralize history state
   - Better state synchronization

## Summary

The fix addresses automatic drawer closing by:
1. **Using ID-based selection** - Stable references across re-renders
2. **Pausing auto-refresh** - No interruptions during viewing
3. **Graceful error handling** - Closes if item disappears

This ensures users can review eligibility results without interruption while maintaining real-time updates when the drawer is closed.

---

*Issue: Drawer auto-closing after 1-2 seconds*  
*Cause: Auto-refresh re-renders with new object references*  
*Status: Fixed ✅*  
*Pattern: ID-based selection + conditional effects*